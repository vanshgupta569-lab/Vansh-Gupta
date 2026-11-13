// FILE: src/components/TerminalDashboard.tsx
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CompanyData, ValuationDrivers, DCFResult, ForecastRow, NewsItem } from '../types';
import { calculateDCFFor, COMPANIES_DATA, AAPL_SOURCE, defaultDriversFor, financialsFromStatements, valuationBandsFor, buildModelFor, buildFullModel, isIntegrityRefusal } from '../data/companies';
import { valuationSummary, premiumOf, admissibleInputs } from '../data/valuationSummary';
import { NOT_REPORTED } from '../data/figureFormat';
import { payloadQuery } from '../data/payloadVersion';
import { FootballField, RatioBand } from './valuationSections';
import type { FieldBand } from './valuationSections';
import { ImpliedByPrice } from './valuationExtras';
import {
  buildAssetApproach,
  RECOVERY_PRESETS,
  DEFAULT_RECOVERY,
} from '../data/assetApproach';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { AssetApproachResult, RecoveryRates } from '../data/assetApproach';
import { buildMarketApproach, trailingFiguresFrom, defaultSelection } from '../data/marketApproach';
import type { MarketApproachResult } from '../data/marketApproach';
import { terminalSpread } from '../data/terminalSpread';
import { inTradingCurrency } from '../data/tradingCurrency';

const isNum = (v: any): v is number => typeof v === 'number' && isFinite(v);
import { reverseDcf } from '../data/reverseDcf';
import type { ReverseDcfResult } from '../data/reverseDcf';
import {
  Disclose,
  Figure,
  Pill,
  MetricTile,
  RefStrip,
  EYEBROW,
  LABEL,
  BODY,
  useMarquee,
} from './instrument';
import { HowCalculated } from './howCalculated';
import { QualitativeAdjustments } from './qualitative';
import { SavedModelsPanel } from './savedModelsPanel';
import { CompsPanel } from './compsPanel';
import { AssetPanel } from './assetPanel';
import { ResidualIncomePanel } from './residualIncomePanel';
import { DataConstraintBanner, DataConstraintPanel } from './dataConstraintPanel';
import { TerminalReliancePanel } from './terminalReliancePanel';
import { ValuationSection, ValuationContents } from './valuationSection';
import { terminalReliance } from '../data/terminalReliance';
import { BatchPanel } from './batchPanel';
import { FullScreenPanel, ThreeStatementView, DCFView } from './nerdViews';
import { downloadWorkbook, buildWorkbook } from '../data/excelExport';
import { downloadPeerWorkbook, gatherPeers, MAX_PEERS } from '../data/peerSpreading';
import HouseTemplatePanel from './houseTemplatePanel';
import { listTemplates, loadTemplate } from '../data/templateStore';
import { fillTemplate, computeModelValues } from '../data/houseTemplate';
import type { Corrections, CorrectionReasons } from '../data/corrections';
import type { HeadAssignment } from '../data/heads';
import type { SavedModel, SavedJudgements } from '../data/savedModels';
import { emptyJudgements } from '../data/savedModels';
import { adjustedEbitdaOf } from '../data/restoreModel';
import { fetchCompanyPayload, buildCompanyFrom } from '../data/autoCompany';
import { reportedRatios, forecastRatios } from '../data/ratios.js';
import { loadDerivedModelData } from '../data/autoCompany';
import { applyVerdicts } from '../data/qualitativeFactors';
import type { Verdict } from '../data/qualitativeFactors';
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
  /**
   * What the reader answered on the questions screen, before the model was
   * built. Null when they skipped, which must produce exactly the model the
   * site would have built on its own.
   */
  initialVerdicts?: Record<string, Verdict> | null;
  /**
   * The judgements that live above this screen, because they are baked into the
   * company RECORD rather than read off the sliders: the reader's corrections to
   * the filed figures, the reasons they gave, and their head assignment.
   * A saved model has to carry them, so this screen has to be able to see them.
   */
  judgements?: { corrections: Corrections; correctionReasons: CorrectionReasons; heads: HeadAssignment };
  /**
   * Reopening a saved model is a REBUILD, not a slider move (`KI-27`). This
   * screen cannot rebuild a record, so it hands the restored judgements up to
   * whoever owns the payload and the company list.
   */
  /**
   * THE WAY TO THE COMPANY PAGE (ROADMAP.md §13). This screen is one tab of
   * that page rather than the whole of a company, and until the name here
   * led somewhere, the hub was reachable only by typing its address.
   */
  onOpenCompanyPage?: (ticker: string, tab?: string) => void;
  onRestoreJudgements?: (
    ticker: string,
    judgements: { corrections: Corrections; correctionReasons: CorrectionReasons; heads: HeadAssignment }
  ) => void;
}

export const TerminalDashboard: React.FC<TerminalDashboardProps> = ({
  companies,
  selectedTicker,
  onSelectTicker,
  onOpenDirectory,
  initialVerdicts,
  judgements,
  onOpenCompanyPage,
  onRestoreJudgements,
}) => {
  const company = companies[selectedTicker] || companies['AAPL'];

  // Tab State

  // The deeper screens open WHOLE SCREENS, not panels on the page. A
  // three-statement model is thirty schedules wide; reading it squeezed under a
  // dashboard is not reading it at all. null means no view is open.
  const [exporting, setExporting] = useState<'house' | 'ours' | null>(null);
  // The peer spreading file takes one fetch per peer, so it says where it is.
  const [spreading, setSpreading] = useState<string | null>(null);
  // A FIRM'S OWN LAYOUT, WHERE ONE HAS BEEN KEPT ON THIS DEVICE. When there is
  // one, the download button fills it instead of handing over ours.
  const [houseTemplate, setHouseTemplate] = useState<{ id: string; name: string } | null>(null);
  /** Bumped when the template screen closes, so the button re-reads the store. */
  const [templateTick, setTemplateTick] = useState(0);
  useEffect(() => {
    let live = true;
    void listTemplates()
      .then((all) => {
        if (live) setHouseTemplate(all[0] ? { id: all[0].id, name: all[0].name } : null);
      })
      .catch(() => {
        if (live) setHouseTemplate(null);
      });
    return () => {
      live = false;
    };
  }, [templateTick]);
  const [nerdView, setNerdView] = useState<
    null | 'THREE_STATEMENT' | 'DCF' | 'QUALITATIVE' | 'SAVED' | 'COMPS' | 'ASSET' | 'BATCH' | 'TEMPLATE'
  >(null);




  // Each deep screen is opened from beside the content it relates to, so the
  // reader meets it where the question arises rather than hunting a menu.
  const OpenScreen: React.FC<{
    view: 'THREE_STATEMENT' | 'DCF' | 'QUALITATIVE' | 'SAVED' | 'COMPS' | 'ASSET';
    label: string;
    strong?: boolean;
  }> = ({ view, label, strong }) => (
    <button
      type="button"
      onClick={() => setNerdView(view)}
      className={`inline-flex items-center gap-2 font-figure text-[11px] uppercase tracking-widest px-4 py-2.5 border transition-colors ${
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
  //
  // A HOUSE TEMPLATE IS AN ADDITION, NOT A REPLACEMENT. When a firm has given
  // us their layout it is what the main button produces, because that is the
  // point of giving it to us. But their template is typically a summary -- it
  // maps the reported lines and has no place for our drivers, schedules or
  // opening balances -- so our own workbook stays one click away rather than
  // being taken off the page. `format` is which one was asked for.
  const exportExcel = (format: 'house' | 'ours' = 'house') => {
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
    setExporting(format);
    void (async () => {
      try {
        const input = {
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
        };

        // THEIR FORMAT IF THEY HAVE GIVEN US ONE AND ASKED FOR IT, ours otherwise.
        const stored =
          format === 'house' && houseTemplate ? await loadTemplate(houseTemplate.id) : null;
        if (stored) {
          const ours = await buildWorkbook(input);
          const valueAt = await computeModelValues(ours);
          const years: string[] = Array.isArray(built.model?.years)
            ? built.model.years.map((y: any) => String(y))
            : [];
          const periods = years.length || 5;
          const filledFile = await fillTemplate(stored.bytes, stored.mapping, valueAt, {
            periods,
            periodLabels: years,
          });
          const blob = new Blob([filledFile.bytes], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          });
          const safe = String(company.ticker || 'model').replace(/[^A-Za-z0-9.-]/g, '');
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${stored.name}_${safe}.xlsx`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        } else {
          await downloadWorkbook(input);
        }
      } catch (error) {
        console.error('Excel export failed', error);
      } finally {
        setExporting(null);
      }
    })();
  };


  // THE PEER SPREADING FILE: the target and the peer set on identical tabs.
  //
  // The peers are whichever companies are in the set ON SCREEN -- including any
  // the reader added or took out -- rather than the set the server first
  // proposed. Each one needs its own filings, so each one is its own fetch; the
  // button says which peer it is on, because ten fetches is long enough that a
  // silent button looks broken.
  const exportPeerSpreading = () => {
    if (!activeSource || !peerSelection.length) return;
    let built: any = nerdModel;
    if (!built) {
      try {
        built = buildFullModel(activeSource, drivers);
      } catch {
        return;
      }
    }
    setSpreading('Reading the filings…');
    void (async () => {
      try {
        const targetSymbol = company.currencySymbol;
        const target = {
          ticker: company.ticker,
          name: company.name,
          model: built.model,
          dcf: built.dcf,
          source: {
            ...activeSource,
            rawStatements: derivedSource?.rawStatements ?? activeSource.rawStatements,
          },
          currencySymbol: targetSymbol,
          unitLabel: activeSource.meta?.unitLabel || `${targetSymbol} millions`,
          price: dcfResult?.marketPrice ?? null,
          priceDate: activeSource.meta?.priceDate ?? null,
          dilutedShares: built.dcf?.dilutedShares ?? null,
          refusal: dcfResult.applicable === false ? String(dcfResult.message || '') : null,
        };
        const wanted = peerSelection.filter((t) => t && t !== company.ticker).slice(0, MAX_PEERS);
        const { companies: peers, missing } = await gatherPeers(wanted, async (ticker) => {
          setSpreading(`Reading ${ticker}…`);
          const payload = await fetchCompanyPayload(ticker);
          const record: any = buildCompanyFrom(payload);
          const source = record.modelData;
          if (!source) return null;
          const peerDrivers = { ...record.defaultDrivers, ...defaultDriversFor(source) };
          const decision = calculateDCFFor(source, peerDrivers, record.price || null);
          const peerBuilt: any = buildFullModel(source, peerDrivers);
          const symbol = payload.currencySymbol || '$';
          return {
            ticker,
            name: payload.name || ticker,
            model: peerBuilt.model,
            dcf: peerBuilt.dcf,
            source,
            currencySymbol: symbol,
            unitLabel: source.meta?.unitLabel || `${symbol} millions`,
            price: typeof record.price === 'number' ? record.price : null,
            priceDate: payload?.quote?.date ?? null,
            dilutedShares: peerBuilt.dcf?.dilutedShares ?? null,
            // A PEER THE SITE WILL NOT VALUE STILL GETS ITS TAB. The comparison
            // is of filings, not of valuations.
            refusal: decision.applicable === false ? String(decision.message) : null,
          };
        });
        if (missing.length) {
          console.warn(
            'Peer spreading: ' +
              missing.map((m) => `${m.ticker} (${m.reason})`).join('; ')
          );
        }
        setSpreading('Writing the workbook…');
        await downloadPeerWorkbook({ target, peers, modelLabel: 'Peer spreading' });
      } catch (error) {
        console.error('Peer spreading export failed', error);
      } finally {
        setSpreading(null);
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

    fetch(`/api/company?${payloadQuery(company.ticker)}`)
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

  // ---- ONE PRICE PER VALUATION (`docs/STUDIO_SPEC.md` S3) ---------------
  //
  // THE SHARE PRICE IS A VALUATION INPUT. The cost of capital weights equity at
  // market capitalisation, so the price moves the WACC and with it every value
  // per share on this screen.
  //
  // This screen held TWO prices until 2026-11-04 (conflict 4, severity H): the
  // stored one the record carries, and a live quote fetched a moment after the
  // page loaded. The bands, the premiums, the reverse DCF and the football
  // field were struck at the live quote; the sensitivity shading and the upside
  // figure were measured against the stored one. A premium could be measured
  // against a price the value was not computed at, and nothing on the screen
  // said which price anything used.
  //
  // So there is ONE struck price, and it is the record's own until the reader
  // asks for the newer one. A live quote arriving while the page is open is a
  // FACT SHOWN BESIDE IT, never silently swapped in: re-pricing a model under
  // the reader as the market moves would change the answer without a judgement.
  const [rebuiltAtPrice, setRebuiltAtPrice] = useState<number | null>(null);
  const struckPrice = rebuiltAtPrice ?? company.price;
  /** The newer quote, only where it is genuinely newer and genuinely different. */
  const newerQuote =
    isNum(liveQuote?.price) &&
    (liveQuote?.price as number) > 0 &&
    Math.abs((liveQuote?.price as number) - struckPrice) > 0.005
      ? (liveQuote?.price as number)
      : null;
  // Everything that is not the valuation — the ticker's own price line, the
  // 52-week range, the change on the day — is the market's figure and shows the
  // latest. Only the VALUATION uses the struck price.
  const displayPrice = struckPrice;

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
  // The ticker measures itself: it only scrolls when the headlines are wider
  // than the window they sit in (`KI-25`).
  const marquee = useMarquee();

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
    // A bank has no inventory, no payables in the trading sense, and its
    // "capital employed" is not what ROCE was built to measure. Those rows are
    // dropped rather than shown as noise.
    if (company.residualIncome?.applicable) {
      const drop = [
        'debtorDays',
        'inventoryDays',
        'daysPayable',
        'cashConversionCycle',
        'roce',
        'netDebtToEbitda',
        'currentRatio',
      ];
      for (const key of drop) {
        (reported as any).applicable[key] = false;
        (forecast as any).applicable[key] = false;
      }
    }

    return { reported, forecast };
  }, [derivedSource, activeSource, drivers, company.residualIncome]);

  // ---------------------------------------------------------------------
  // THE MARKET APPROACH
  //
  // The peer set used to be fetched only when the Comparable Companies screen
  // was opened, because it was only a cross-check. It is now one of the three
  // approaches to value and appears on the front page, so it is fetched once
  // per company here and handed down to the full screen rather than fetched
  // twice.
  // ---------------------------------------------------------------------
  const [compsData, setCompsData] = useState<any>(null);
  const [compsLoading, setCompsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setCompsLoading(true);
    setCompsData(null);
    fetch(`/api/comps?ticker=${encodeURIComponent(company.ticker)}`)
      .then((res) => res.json())
      .then((body) => {
        if (!cancelled) setCompsData(body);
      })
      .catch(() => {
        if (!cancelled) setCompsData(null);
      })
      .finally(() => {
        if (!cancelled) setCompsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [company.ticker]);

  // One engine run that both the market approach and the comps screen read
  // from, so the EBITDA on the front page and the EBITDA on the full screen
  // can never be two different numbers.
  const baseBuild = useMemo(() => {
    if (!activeSource) return null;
    try {
      return buildFullModel(activeSource, drivers);
    } catch {
      return null;
    }
  }, [activeSource, drivers]);

  // A model whose balance sheet does not balance, or whose filing lacks a line
  // net debt depends on, gets no valuation of ANY kind: the engine refuses the
  // discounted cash flow, and every other value on this page (the market and
  // asset approaches, the reverse DCF, residual income) is withheld with it.
  // The site must never show a value for a model that does not add up.
  const integrityRefused = isIntegrityRefusal(baseBuild?.dcf?.code);

  const subjectTrailing = useMemo(
    () =>
      baseBuild
        ? trailingFiguresFrom(baseBuild.model, baseBuild.dcf, activeSource)
        : null,
    [baseBuild, activeSource]
  );

  // Which companies are in the peer set. Null means "whatever the site chose";
  // an array means the reader has taken over. Cleared when the company changes,
  // because a peer set chosen for one company means nothing for another.
  const [selectedPeers, setSelectedPeers] = useState<string[] | null>(null);
  useEffect(() => {
    setSelectedPeers(null);
  }, [company.ticker]);

  const marketApproach: MarketApproachResult | null = useMemo(() => {
    if (integrityRefused || !compsData || !subjectTrailing) return null;
    return buildMarketApproach(compsData, subjectTrailing, selectedPeers);
  }, [integrityRefused, compsData, subjectTrailing, selectedPeers]);

  const peerSelection = useMemo(
    () => selectedPeers ?? defaultSelection(compsData),
    [selectedPeers, compsData]
  );

  // ---------------------------------------------------------------------
  // THE ASSET APPROACH
  //
  // Built from the FILINGS, not from the forecast. An asset approach is a
  // statement about what exists today; the moment it borrows a projected
  // balance sheet it stops answering its own question. So this reads the last
  // reported year straight out of the fetched statements.
  //
  // The recovery rates are the reader's, not ours. Two presets, because the
  // honest answer depends entirely on whether the company is being closed in a
  // panic or wound down in an orderly way, and a single default hides that.
  // ---------------------------------------------------------------------
  const [recoveryKey, setRecoveryKey] = useState<'forcedSale' | 'orderly' | 'custom'>(
    'forcedSale'
  );
  const [recoveryRates, setRecoveryRates] = useState<RecoveryRates>(DEFAULT_RECOVERY);

  const applyRecoveryPreset = (key: 'forcedSale' | 'orderly') => {
    const preset = RECOVERY_PRESETS.find((p) => p.key === key);
    if (!preset) return;
    setRecoveryKey(key);
    setRecoveryRates(preset.rates);
  };

  // Moving any single rate means the reader is no longer following either
  // convention, so the screen stops claiming one.
  const setRecoveryRate = (key: keyof RecoveryRates, value: number) => {
    setRecoveryRates((prev) => ({ ...prev, [key]: value }));
    setRecoveryKey('custom');
  };




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
      nerdView === 'ASSET' ||
      nerdView === 'BATCH' ||
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
  //
  // The judgements made before the model was built are applied here, on top of
  // whichever model is active, and re-applied when the model changes beneath
  // them. They are always computed from that model's own defaults rather than
  // from the current slider positions, so switching models twice cannot apply
  // the same view twice.
  //
  // Two pieces of state, deliberately separate. `verdicts` is what the reader
  // has ticked — it is seeded from the questions screen so that reopening the
  // panel shows the answers already given, rather than a blank sheet. It moves
  // as soon as a button is pressed and moves nothing else. `appliedVerdicts` is
  // what is actually baked into the model, and only changes when the reader
  // presses "Apply to the model". Keeping them apart is what lets the panel
  // show a pending change before it happens.
  const [verdicts, setVerdicts] = useState<Record<string, Verdict>>(
    initialVerdicts ?? {}
  );
  const [appliedVerdicts, setAppliedVerdicts] = useState<Record<string, Verdict> | null>(
    initialVerdicts ?? null
  );

  // A new company (or a fresh run through the questions screen) replaces both.
  useEffect(() => {
    setVerdicts(initialVerdicts ?? {});
    setAppliedVerdicts(initialVerdicts ?? null);
  }, [initialVerdicts]);

  useEffect(() => {
    setDrivers(
      appliedVerdicts ? applyVerdicts(activeDefaults, appliedVerdicts) : activeDefaults
    );
  }, [viewMode, derivedSource, analystSource, appliedVerdicts]);

  /** Sliders off the model's own figures, for the saved-models panel to count. */
  const slidersChanged = useMemo(
    () =>
      (Object.keys(activeDefaults) as (keyof ValuationDrivers)[]).filter(
        (key) =>
          activeDefaults[key] !== undefined &&
          drivers[key] !== undefined &&
          Number(drivers[key]) !== Number(activeDefaults[key])
      ).length,
    [drivers, activeDefaults]
  );

  // ------------------------------------------------------------------------
  // SAVING AND REOPENING A SET OF JUDGEMENTS (`KI-27`)
  // ------------------------------------------------------------------------
  //
  // `savedJudgements` is EVERY input that decides this valuation, gathered in
  // one place so that a saved record cannot quietly miss one. It is assembled
  // here rather than inside the panel because this is where the inputs live,
  // and because a panel that reached into the dashboard for six pieces of state
  // would be a second place that had to remember all six.
  //
  // THE SHARE PRICE IS IN IT. Not a judgement: an input. The cost of capital
  // weights equity at market capitalisation, so where the reader has left the
  // WACC alone the price feeds the answer, and a valuation is struck at a
  // moment. Where they have set the WACC by hand the price has no route in, and
  // carrying it then costs nothing.
  const savedJudgements: SavedJudgements = useMemo(
    () => ({
      ...emptyJudgements(),
      drivers: { ...(drivers as any) },
      viewMode,
      corrections: judgements?.corrections ?? {},
      correctionReasons: judgements?.correctionReasons ?? {},
      heads: judgements?.heads ?? {},
      verdicts: { ...verdicts },
      appliedVerdicts: appliedVerdicts ? { ...appliedVerdicts } : null,
      peers: selectedPeers ? [...selectedPeers] : null,
      recovery: { key: recoveryKey, rates: { ...(recoveryRates as any) } },
      sharePrice: isNum(displayPrice) && displayPrice > 0 ? displayPrice : null,
    }),
    [drivers, viewMode, judgements, verdicts, appliedVerdicts, selectedPeers, recoveryKey, recoveryRates, displayPrice]
  );

  /**
   * Reopen a saved set. Order matters and is the whole of the fix.
   *
   *   1. The judgements that rebuild the RECORD go up first, because the record
   *      is what the derivation, the forecast and the EBITDA bridge come from.
   *   2. The view mode and the applied verdicts next, because an effect
   *      recomputes the sliders from them.
   *   3. The sliders last, on a later tick, so that effect cannot overwrite
   *      them. They are the final positions, whatever the verdicts did to get
   *      there.
   */
  const restoreSaved = (entry: SavedModel) => {
    const j = entry.judgements;
    onRestoreJudgements?.(entry.ticker, {
      corrections: j.corrections,
      correctionReasons: j.correctionReasons,
      heads: j.heads,
    });
    setViewMode(j.viewMode);
    setVerdicts((j.verdicts ?? {}) as any);
    setAppliedVerdicts(j.appliedVerdicts ? (j.appliedVerdicts as any) : null);
    setSelectedPeers(j.peers ? [...j.peers] : null);
    if (j.recovery) {
      setRecoveryKey((j.recovery.key as any) ?? 'custom');
      setRecoveryRates(j.recovery.rates as any);
    }
    window.setTimeout(() => setDrivers(j.drivers as any), 0);
    setNerdView(null);
  };

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
    const diff = dcfResult.targetPrice - struckPrice;
    return Number(((diff / struckPrice) * 100).toFixed(1));
  }, [dcfResult.targetPrice, struckPrice]);

  // A bank the discounted cash flow refuses, but the residual income model
  // can value. The two are never blended: they answer different questions and
  // mixing them would hide which one produced the number.
  //
  // Not gated on integrityRefused: residual income is built on the filed
  // balance sheet, and the company record already withholds it when that
  // sheet does not balance (autoCompany.ts). A bank whose forecast cannot be
  // computed keeps its refused DCF but still shows this value.
  const bankModel =
    dcfResult.applicable === false && company.residualIncome?.applicable
      ? company.residualIncome
      : null;

  // ---------------------------------------------------------------------
  // THE REVERSE DCF
  //
  // Solved on every driver change, because the whole point is that it answers
  // for the model as it currently stands, not for some earlier version of it.
  // ---------------------------------------------------------------------
  const impliedByPrice: ReverseDcfResult | null = useMemo(() => {
    if (!activeSource || bankModel || integrityRefused) return null;
    try {
      return reverseDcf(activeSource, drivers, displayPrice);
    } catch {
      return null;
    }
  }, [activeSource, drivers, displayPrice, bankModel, integrityRefused]);

  const assetApproach: AssetApproachResult | null = useMemo(() => {
    // Two sources of a reported balance sheet, in order of preference.
    //
    // 1. The filings as fetched. These carry goodwill and intangibles, so the
    //    tangible book measure can be computed.
    // 2. Failing that, the engine's own historical columns. A hand-built model
    //    has no fetched statements behind it, and its data file does not carry
    //    a goodwill line, so tangible book is reported as not disclosed rather
    //    than guessed. Everything else still works.
    if (integrityRefused) return null;
    const raw = derivedSource?.rawStatements ?? activeSource?.rawStatements;
    let lastReported: any = null;

    if (Array.isArray(raw) && raw.length) {
      lastReported = raw[raw.length - 1];
    } else if (baseBuild?.model?.balanceSheet) {
      const B = baseBuild.model.balanceSheet;
      const i = (baseBuild.model.nH ?? 0) - 1;
      const at = (series: any) =>
        Array.isArray(series) && typeof series[i] === 'number' && isFinite(series[i])
          ? series[i]
          : null;
      const sumOf = (...vals: (number | null)[]) => {
        const present = vals.filter((v): v is number => typeof v === 'number');
        return present.length ? present.reduce((a, b) => a + b, 0) : null;
      };
      lastReported = {
        fiscalYear: activeSource?.meta?.historicalYears?.[i] ?? null,
        cash: at(B.cashAndSecurities),
        receivables: at(B.accountsReceivable),
        inventory: at(B.inventory),
        currentAssets: sumOf(
          at(B.cashAndSecurities),
          at(B.accountsReceivable),
          at(B.inventory),
          at(B.deferredTaxAssets),
          at(B.otherCurrentAssets)
        ),
        ppeNet: at(B.propertyPlantEquipment),
        totalAssets: at(B.totalAssets),
        totalLiabilities: at(B.totalLiabilities),
        goodwill: null,
        intangibles: null,
      };
    }

    if (!lastReported) return null;
    // Share counts arrive from the filings as raw counts; every money figure is
    // in millions. Divide so the two are in the same units before dividing one
    // by the other.
    const rawShares =
      typeof lastReported?.dilutedShares === 'number'
        ? lastReported.dilutedShares
        : null;
    const sharesInMillions =
      typeof rawShares === 'number' && isFinite(rawShares) && rawShares > 0
        ? rawShares / 1e6
        : subjectTrailing?.dilutedShares ?? null;
    try {
      return buildAssetApproach(
        lastReported,
        sharesInMillions,
        recoveryRates,
        Boolean(bankModel) || Boolean(company.residualIncome?.applicable)
      );
    } catch {
      return null;
    }
  }, [
    integrityRefused,
    derivedSource,
    activeSource,
    baseBuild,
    subjectTrailing,
    recoveryRates,
    bankModel,
    company.residualIncome,
  ]);

  // ---- THE VALUATION SUMMARY (build step 5, job B1) ---------------------
  //
  // `valuationBands`, `terminalMethods`, `premiumAgainst` and `fieldBands` were
  // four `useMemo`s in this component, which meant the tearsheet and the
  // workbook could only have them by computing them again. They are one pure
  // function now (`src/data/valuationSummary.ts`), struck at one price, and
  // this screen reads it.
  const summary = useMemo(
    () => valuationSummary(activeSource, drivers, struckPrice, marketApproach, assetApproach),
    [activeSource, drivers, struckPrice, marketApproach, assetApproach]
  );
  const valuationBands = summary.bands;

  // The headline is two numbers and the premium against each, both from the
  // summary above. Why they are never averaged is in `valuationSummary.ts`.
  const terminalMethods = summary.terminalMethods;
  const premiumAgainst = summary.premiumAgainst;

  // Every approach as a bar, from the summary above.
  const fieldBands: FieldBand[] = summary.fieldBands as FieldBand[];

  /**
   * THE CONTENTS LIST, BUILT FROM THE SECTIONS THAT ARE ACTUALLY THERE.
   *
   * Written out by hand it would go stale the first time a section appeared
   * for one company and not another -- a bank has no cash flow walkthrough, a
   * company with no usable peers has no market approach -- and a contents
   * entry that scrolls nowhere is worse than no contents at all. So each
   * entry carries the SAME condition as the section it points to, and the two
   * are read from one place.
   */
  const contentsEntries = useMemo(() => {
    const rows: { id: string; label: string; when: boolean }[] = [
      { id: 'ratios', label: 'Ratios', when: true },
      { id: 'football', label: 'Valuation range', when: dcfResult.applicable !== false },
      { id: 'implied', label: 'What the price assumes', when: dcfResult.applicable !== false && !!impliedByPrice },
      { id: 'working', label: bankModel ? 'How it was valued' : 'How it was calculated', when: !!activeSource || !!bankModel },
      { id: 'market', label: 'Market approach', when: !!marketApproach },
      { id: 'asset', label: 'Asset approach', when: !!assetApproach },
      { id: 'terminal', label: 'Beyond the forecast', when: !!activeSource && dcfResult.applicable !== false },
      { id: 'constraints', label: 'What the source lacks', when: true },
      { id: 'nerds', label: 'Full working', when: !bankModel },
    ];
    return rows.filter((r) => r.when).map(({ id, label }) => ({ id, label }));
  }, [dcfResult.applicable, impliedByPrice, activeSource, bankModel, marketApproach, assetApproach]);

  const bankPremiumPct = useMemo(() => {
    if (!bankModel || !(bankModel.valuePerShare > 0)) return null;
    return premiumOf(struckPrice, bankModel.valuePerShare);
  }, [bankModel, struckPrice]);

  // ---- THE SAME FIGURES IN THE CURRENCY THE SHARE TRADES IN -------------
  //
  // A company is modelled in the currency its statements are in, and
  // discounted at that currency's own bond yield, because a cash flow and
  // its discount rate have to describe one economy (METHODOLOGY.md S3 and
  // S14). Infosys files in US dollars and trades in Bombay, so the honest
  // model gives a dollar value per share -- and a reader on the NSE is
  // looking at rupees.
  //
  // So every figure here is shown in BOTH, converted at the one rate the
  // price was converted at and disclosed below. Nothing in the model moves:
  // this divides an answer. On the great majority of companies the two
  // currencies are the same and these are all null, so nothing is added to
  // the screen.
  const inTrading = {
    value: inTradingCurrency(terminalMethods.perpetuity ?? dcfResult.targetPrice, company.currencyBasis),
    exit: inTradingCurrency(terminalMethods.exit, company.currencyBasis),
    price: inTradingCurrency(displayPrice, company.currencyBasis),
    bank: inTradingCurrency(bankModel?.valuePerShare, company.currencyBasis),
  };

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

  // ---- THE SENSITIVITY GRID (`docs/STUDIO_SPEC.md` §4.5) -----------------
  //
  // TWO THINGS WERE WRONG WITH IT, and they were the same thing twice: the grid
  // and its axes were not computed from each other.
  //
  //   EVERY CELL WAS CLAMPED AND THE AXIS WAS NOT (conflict 5, severity H).
  //   The cell ran at `Math.max(4, wacc)` and `Math.max(0.5, growth)` while the
  //   label printed the unclamped figure, so with terminal growth at 1.0% the
  //   0.0% and 0.5% columns were BOTH computed at 0.5% and printed the same
  //   value under two different labels.
  //
  //   AND IT DISAGREED WITH THE RANGES ON THE SAME PAGE ($111 against $112.90,
  //   `docs/STUDIO_SPEC_ADDENDUM.md` G2). The football field's income range is
  //   the row through the base cell of THE ENGINE'S grid; this was a second
  //   grid, re-run here through `runDCF` with overridden drivers, and two
  //   computations of one thing disagree the moment either changes.
  //
  // So there is one grid. The engine publishes it with the axes it was computed
  // at (`model.js`, `R.sensitivity` and `R.sensitivityAxes`), the bands already
  // read it, and this screen now reads the same arrays. The row through the
  // base cell IS the range printed on the page, by construction rather than by
  // agreement.
  const gridAxes = (dcfResult as any)?.sensitivityAxes;
  const waccRange: number[] = Array.isArray(gridAxes?.wacc)
    ? gridAxes.wacc.map((v: number) => v * 100)
    : [];
  const gRange: number[] = Array.isArray(gridAxes?.growth)
    ? gridAxes.growth.map((v: number) => v * 100)
    : [];
  const sensitivityMatrix: number[][] = Array.isArray((dcfResult as any)?.sensitivity?.perpetuity)
    ? (dcfResult as any).sensitivity.perpetuity
    : [];

  /**
   * WHETHER A PAIR OF INPUTS IS ADMISSIBLE AT ALL, read from the figures the
   * axes PRINT. A perpetuity needs a discount rate above its growth rate: at or
   * below it the formula diverges, and what comes back is not a large value but
   * no value. A negative discount rate is not a discount rate.
   */
  const admissible = admissibleInputs;

  /**
   * ONE OF THE THREE DISPLAYED RATIOS, as the screen prints it.
   *
   * A figure where there is one; an em dash with the reason behind it where the
   * filing cannot support it. It never prints nought: `?? 0` on these three is
   * what made a return on equity nobody could compute read `0.0%`, which is a
   * claim the company reported nil (conflict 6, standing decision 3).
   */
  /**
   * A TILE'S LABEL NAMES THE BASIS IT IS ON (G9, conflict 17).
   *
   * These three read `ROE (LTM)`, `ROA (LTM)` and `Op margin` and were the LAST
   * REPORTED FISCAL YEAR — `M.ratios.roe[last]`, not a trailing twelve months.
   * On NVIDIA the label said LTM at 76.3% while the trailing operating margin on
   * the Financials tab was 65.2%: two figures, one of them labelled as something
   * it is not. A label that says LTM must show LTM, so these say which year.
   */
  const ratioLabel = (name: string) => {
    const year = company.plainRatios?.asOfYear;
    return year ? `${name} (FY${String(year).slice(-2)})` : `${name} (last reported year)`;
  };

  const ratioTile = (field: 'roePct' | 'roaPct' | 'opMarginPct') => {
    const value = company[field];
    if (!isNum(value)) {
      return (
        <span data-ratio-missing={field} title={company.ratiosNotShown?.[field]}>
          {NOT_REPORTED}
        </span>
      );
    }
    return <span data-ratio={field}>{`${value.toFixed(1)}%`}</span>;
  };

  const [hoveredMatrixCell, setHoveredMatrixCell] = useState<{ wacc: number; g: number; val: number } | null>(null);

  return (
    <section id="terminal" className="pt-24 pb-20 max-w-[1440px] mx-auto px-6 lg:px-12">
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
                <span className="font-figure text-[11px] text-[#8B1E1E] font-bold tracking-widest shrink-0">
                  {company.ticker}
                </span>
                <span className="font-sans text-sm text-[#A1A1AA] font-light truncate hidden sm:block">
                  {company.name}
                </span>
              </div>

              <div className="flex items-center gap-6 shrink-0">
                <div className="text-right">
                  <div className="font-figure text-[9px] text-[#8A8A8F] uppercase tracking-widest">
                    Price
                  </div>
                  <div className="font-figure text-sm text-[#F2F0EA]">
                    <TweenNumber value={displayPrice} prefix={company.currencySymbol} />
                  </div>
                </div>

                {hasRealModel && (
                  <div className="text-right">
                    <div className="font-figure text-[9px] text-[#8A8A8F] uppercase tracking-widest">
                      Implied
                    </div>
                    <div className="font-figure text-sm text-[#8B1E1E] font-semibold">
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

      {/* ==================================================================
          SCREEN CHROME — which company, and how to change it.

          This row used to open with "Company Specific Analysis" set in 30px
          display type: the largest thing on the screen, telling a reader
          something they had just typed in themselves. It is an eyebrow now,
          and the space it took went to the figure the screen exists to show.
          ================================================================== */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <span className={`${EYEBROW} text-quiet`}>Company analysis</span>

        <div className="flex flex-wrap items-center gap-1.5">
          {Object.keys(companies).map((t) => (
            <button
              key={t}
              onClick={() => onSelectTicker(t)}
              className={`${LABEL} cursor-pointer px-2.5 py-1 uppercase tracking-wider transition-colors ${
                selectedTicker === t
                  ? 'border border-accent bg-accent font-semibold text-ink'
                  : 'border border-line bg-panel text-muted hover:border-quiet/40 hover:text-ink'
              }`}
            >
              {t}
            </button>
          ))}
          <button
            onClick={onOpenDirectory}
            className={`${LABEL} ml-1 cursor-pointer border border-line px-2.5 py-1 uppercase tracking-wider text-accent-text transition-colors hover:border-accent hover:text-ink`}
          >
            + All
          </button>
        </div>
      </div>

      {/* WHAT THE SOURCE DOES NOT GIVE US, before any number is read. The
          full list sits beside the working; this is only the ones that could
          move the value. */}
      <DataConstraintBanner
        constraints={company.dataConstraints ?? []}
        onSeeDetail={() => {
          document.getElementById('data-constraints')?.scrollIntoView({ behavior: 'smooth' });
        }}
      />

      {/* ==================================================================
          THE VERDICT — the figures a reader came for, then the account of
          them behind a disclosure.

          What changed, and why: the company name was set at 48px, the price
          at 36px and the value at 30px, so the page led with the one fact the
          reader had supplied and buried the one it had computed. Three lines
          of prose sat under the value explaining the method, the spread and
          where to find the working, and a reader had to read past all of it
          every visit. The figures are now the largest things on the screen
          and the prose is one row below them, open when it is wanted.
          ================================================================== */}
      <section aria-label="Valuation" className="mb-6 border border-line bg-panel">
        {/* Identity, as reference rather than headline. */}
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-line px-5 py-4 lg:px-6">
          <div className="min-w-0">
            <div className="mb-1.5 flex items-baseline gap-2.5">
              <span className="font-figure text-[13px] font-bold tracking-[0.16em] text-accent-text">
                {company.ticker}
              </span>
              {onOpenCompanyPage ? (
                <h1 className="min-w-0">
                  <button
                    type="button"
                    onClick={() => onOpenCompanyPage(company.ticker)}
                    title={`Everything on ${company.name}: overview, financials, filings, ownership`}
                    className="block max-w-full truncate font-display text-[19px] font-medium tracking-tight text-ink transition-colors hover:text-accent-text cursor-pointer sm:text-[22px]"
                  >
                    {company.name}
                  </button>
                </h1>
              ) : (
                <h1 className="truncate font-display text-[19px] font-medium tracking-tight text-ink sm:text-[22px]">
                  {company.name}
                </h1>
              )}
            </div>
            <RefStrip
              items={[
                ['exch', company.exchange],
                ['sector', company.sector],
                ['isin', company.isin],
              ]}
            />
          </div>

          {/* The model switch belongs beside the number it changes. */}
          {canCompare && (
            <div className="flex items-center gap-2">
              <span className={`${EYEBROW} text-quiet`}>Model</span>
              <div className="flex border border-line">
                {(['DERIVED', 'ANALYST'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setViewMode(mode)}
                    className={`${LABEL} cursor-pointer px-3 py-1.5 uppercase tracking-wider transition-colors ${
                      viewMode === mode ? 'bg-accent font-semibold text-ink' : 'text-muted hover:text-ink'
                    }`}
                  >
                    {mode === 'DERIVED' ? 'Derived' : 'Analyst'}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ---- THE NEWER QUOTE, AND THE ONE ACTION THAT TAKES IT ----------
            A quote that arrived after this model was struck is shown as a fact
            with the action beside it (`docs/STUDIO_SPEC.md` S3, approved 4
            November 2026). It is never swapped in: the price sets the equity
            weight in the cost of capital, so re-pricing the model as the
            market moves would change every value on the screen with no
            judgement made and nothing saying it had happened. */}
        {newerQuote !== null && (
          <div
            data-newer-quote={newerQuote}
            className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 border border-line bg-panel px-4 py-3"
          >
            <span className="text-[13px] text-muted">
              Latest quote {company.currencySymbol}
              {newerQuote.toFixed(2)}. This valuation is struck at {company.currencySymbol}
              {struckPrice.toFixed(2)}, which is the price its cost of capital weighs equity at.
            </span>
            <button
              type="button"
              data-rebuild-at-latest
              onClick={() => setRebuiltAtPrice(newerQuote)}
              className="cursor-pointer border border-line px-3 py-1.5 text-[13px] text-muted transition-colors hover:border-accent hover:text-ink"
            >
              Rebuild at the latest price
            </button>
          </div>
        )}

        {/* The figures. A hairline grid — one background with the gaps let
            through — so the columns divide without three more borders. */}
        {bankModel ? (
          <div className="grid gap-px bg-line sm:grid-cols-2">
            <div className="bg-panel px-5 py-5 lg:px-6">
              <Figure
                scale="hero"
                eyebrow="Intrinsic value · residual income"
                value={`${company.currencySymbol}${bankModel.valuePerShare.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}`}
                pill={
                  /* NO COLOUR CARRIES THE SIGN (STUDIO_SPEC 4.2, standing
                     decision 6, Nihar 2026-11-13). A premium was a red pill
                     and a discount a green one -- a traffic light, and an
                     opinion on a security dressed as a style. The words say
                     which way it is; the pill is neutral. */
                  bankPremiumPct !== null ? (
                    <Pill tone="neutral">
                      {`Price ${Math.abs(bankPremiumPct)}% ${bankPremiumPct > 0 ? 'above' : 'below'}`}
                    </Pill>
                  ) : undefined
                }
                foot={
                  inTrading.bank
                    ? `valued as a bank · ${inTrading.bank.text} in ${inTrading.bank.currency}`
                    : 'valued as a bank'
                }
              />
            </div>
            <div className="bg-panel px-5 py-5 lg:px-6">
              <Figure
                eyebrow={`Price the valuation is struck at · ${company.currency}`}
                value={`${company.currencySymbol}${struckPrice.toFixed(2)}`}
                foot={
                  /* ONE PRICE PER VALUATION (S3). A newer quote is a fact
                     beside the figure, never swapped into it: the price sets
                     the equity weight in the cost of capital, so re-pricing
                     the model under the reader would change the answer with
                     no judgement made. */
                  newerQuote
                    ? `Latest ${company.currencySymbol}${newerQuote.toFixed(2)}; this valuation uses ${company.currencySymbol}${struckPrice.toFixed(2)}`
                    : inTrading.price
                      ? `${inTrading.price.text} as quoted`
                      : undefined
                }
                pill={
                  <Pill tone={displayChangePct >= 0 ? 'positive' : 'negative'}>
                    {displayChangePct >= 0 ? '+' : ''}
                    {displayChangePct}%
                  </Pill>
                }
              />
            </div>
          </div>
        ) : hasRealModel && dcfResult.applicable !== false ? (
          <div className="grid gap-px bg-line sm:grid-cols-2 lg:grid-cols-[1.25fr_1fr_1fr]">
            {/* Named as the headline, because where one figure is needed it is
                this one: the exit multiple rests on a multiple that is the
                same for every derived company. */}
            <div className="bg-panel px-5 py-5 lg:px-6">
              <FlashOnChange watch={viewMode} className="-mx-1 block px-1">
                <Figure
                  scale="hero"
                  eyebrow="Intrinsic value · perpetuity growth"
                  value={
                    <TweenNumber
                      value={(terminalMethods.perpetuity ?? dcfResult.targetPrice) as number}
                      prefix={company.currencySymbol}
                    />
                  }
                  foot={
                    inTrading.value
                      ? `${inTrading.value.text} in ${inTrading.value.currency}, the currency the share trades in`
                      : undefined
                  }
                  pill={
                    premiumAgainst.perpetuity !== null ? (
                      <Pill tone="neutral">
                        {`Price ${Math.abs(premiumAgainst.perpetuity)}% ${
                          premiumAgainst.perpetuity > 0 ? 'above' : 'below'
                        }`}
                      </Pill>
                    ) : undefined
                  }
                />
              </FlashOnChange>
            </div>

            {isNum(terminalMethods.exit) && (
              <div className="bg-panel px-5 py-5 lg:px-6">
                <FlashOnChange watch={viewMode} className="-mx-1 block px-1">
                  <Figure
                    eyebrow="Exit multiple"
                    value={
                      <TweenNumber value={terminalMethods.exit as number} prefix={company.currencySymbol} />
                    }
                    foot={inTrading.exit ? `${inTrading.exit.text} in ${inTrading.exit.currency}` : undefined}
                    pill={
                      premiumAgainst.exit !== null ? (
                        <Pill tone="neutral">
                          {`Price ${Math.abs(premiumAgainst.exit)}% ${
                            premiumAgainst.exit > 0 ? 'above' : 'below'
                          }`}
                        </Pill>
                      ) : undefined
                    }
                  />
                </FlashOnChange>
              </div>
            )}

            <div className="bg-panel px-5 py-5 lg:px-6">
              <Figure
                eyebrow={`Price the valuation is struck at · ${company.currency}`}
                value={`${company.currencySymbol}${struckPrice.toFixed(2)}`}
                foot={
                  /* ONE PRICE PER VALUATION (S3). A newer quote is a fact
                     beside the figure, never swapped into it: the price sets
                     the equity weight in the cost of capital, so re-pricing
                     the model under the reader would change the answer with
                     no judgement made. */
                  newerQuote
                    ? `Latest ${company.currencySymbol}${newerQuote.toFixed(2)}; this valuation uses ${company.currencySymbol}${struckPrice.toFixed(2)}`
                    : inTrading.price
                      ? `${inTrading.price.text} as quoted`
                      : undefined
                }
                pill={
                  <Pill tone={displayChangePct >= 0 ? 'positive' : 'negative'}>
                    {displayChangePct >= 0 ? '+' : ''}
                    {displayChangePct}%
                  </Pill>
                }
              />
            </div>
          </div>
        ) : (
          <div className="px-5 py-6 lg:px-6">
            <div className={`${EYEBROW} mb-2 text-quiet`}>NO VALUE SHOWN</div>
            <p className={`${BODY} max-w-prose text-read`}>
              {dcfResult.applicable === false && dcfResult.message
                ? dcfResult.message
                : 'Placeholder record. Search this ticker in the directory to build a model from its filings.'}
            </p>
          </div>
        )}

        {/* ---- THE ACCOUNT, ON DEMAND ----------------------------------
            Everything that used to be prose sitting open under the figures.
            The spread itself stays visible on the closed row, because it is a
            measurement rather than an explanation: a reader comparing two
            values has to know they disagree without opening anything. What
            opens is what the disagreement MEANS. */}
        <div className="px-5 lg:px-6">
          {terminalMethods.split && (
            <Disclose
              summary="Why there are two values, and what the gap means"
              trailing={`the two methods are ${(terminalMethods.split.spread * 100).toFixed(0)}% apart`}
            >
              <p className="max-w-prose">
                {terminalMethods.split.wide
                  ? terminalMethods.split.sentence
                  : 'The perpetuity method grows the last forecast year for ever at the terminal rate; the exit multiple capitalises that year’s EBITDA at an assumed multiple. They answer the same question two ways and are never averaged, because an average is neither method’s answer and hides the disagreement — which is the useful part.'}
              </p>
              <p className="mt-2 max-w-prose text-quiet">
                Where one figure is needed it is the perpetuity value, because it is built from this
                company’s own cash flows; the exit multiple rests on a multiple that is the same for
                every derived company.
              </p>
            </Disclose>
          )}

          {/* WHAT CURRENCY EVERYTHING ON THIS SCREEN IS IN.

              The rate named here used to be `rate`, the composite the quoted
              figure is multiplied by, printed beside the name of the pair it
              came from. London quotes pence, so that read "Converted at
              0.013246 (GBPUSD=X)" where GBPUSD=X is 1.3246 -- a disclosed
              figure a hundred times away from the thing it was labelled as,
              on ten of the forty-nine converted companies. It is now the
              pair's own rate, with the quoted unit said separately. */}
          {company.currencyBasis?.priceConverted && (
            <Disclose
              summary={
                inTrading.price
                  ? 'What this price is quoted in, and what the value is worth in it'
                  : 'What this price is quoted in'
              }
            >
              <p className="max-w-prose">
                Quoted in {company.currencyBasis.quotedCurrency}
                {company.currencyBasis.minorUnitFactor != null &&
                company.currencyBasis.minorUnitFactor !== 1
                  ? `, ${Math.round(1 / company.currencyBasis.minorUnitFactor)} to one ${
                      company.currencyBasis.tradingCurrency
                    }`
                  : ''}
                ; shown in {company.currencyBasis.reportingCurrency}, the currency the statements are
                in, so the price and the value beside it can be compared.{' '}
                {inTrading.price ? (
                  <>
                    Converted at {Number(inTrading.price.rate.toPrecision(6))}{' '}
                    {company.currencyBasis.reportingCurrency} per {inTrading.price.currency}
                    {company.currencyBasis.pair ? ` (${company.currencyBasis.pair}` : ''}
                    {company.currencyBasis.pair && company.currencyBasis.rateAsOf
                      ? `, ${company.currencyBasis.rateAsOf.slice(0, 10)})`
                      : company.currencyBasis.pair
                        ? ')'
                        : ''}
                    .
                  </>
                ) : (
                  <>No exchange rate is involved: the two are the same currency in different units.</>
                )}
              </p>
              {inTrading.price && (
                <p className="mt-2 max-w-prose text-quiet">
                  The model is built in {company.currencyBasis.reportingCurrency} throughout, down to the
                  government bond yield it discounts at, because a cash flow and the rate it is discounted
                  at have to describe one economy. The {inTrading.price.currency} figure under each value
                  is that answer divided by the rate above — the last step, applied once to an answer. It
                  moves with the rate, as the price does, so the premium or discount between them does not.
                </p>
              )}
            </Disclose>
          )}

          <Disclose summary="Where the working is">
            <p className="max-w-prose">
              Every line of it is on this page, below: how the value was calculated, the ratios the
              forecast produces, the valuation range, what the current price assumes, and the full
              three-statement model and discounted cash flow. The Excel workbook carries the same
              model with its formulas live.
            </p>
          </Disclose>
        </div>

        {/* ---- WHAT A READER DOES NEXT --------------------------------- */}
        <div className="flex flex-wrap items-center gap-2 border-t border-line px-5 py-4 lg:px-6">
          {hasRealModel && dcfResult.applicable !== false && (
            <button
              type="button"
              onClick={() => exportExcel('house')}
              disabled={exporting !== null}
              className={`${LABEL} inline-flex items-center gap-2 border border-accent bg-accent/20 px-3.5 py-2 uppercase tracking-widest text-ink transition-colors hover:bg-accent/35 disabled:opacity-40`}
              title="Download the full model as one Excel workbook"
            >
              <Download className="h-3.5 w-3.5" />
              {exporting === 'house'
                ? 'Building the workbook…'
                : houseTemplate
                  ? `Download in ${houseTemplate.name}`
                  : 'Download Excel model'}
            </button>
          )}
          {/* OUR OWN LAYOUT, STILL ONE CLICK AWAY. A firm's template maps the
              lines it has rows for; the rest of the 138 are reported on the
              report sheet, but the full model in our layout is the thing to
              open when a driver or a schedule is what you are after. */}
          {hasRealModel && dcfResult.applicable !== false && houseTemplate && (
            <button
              type="button"
              onClick={() => exportExcel('ours')}
              disabled={exporting !== null}
              className={`${LABEL} inline-flex items-center gap-2 border border-line px-3.5 py-2 uppercase tracking-widest text-muted transition-colors hover:border-accent hover:text-ink disabled:opacity-40`}
              title="The full 138-line model in the Marginalia layout, including the drivers and schedules your template has no rows for"
            >
              <Download className="h-3.5 w-3.5" />
              {exporting === 'ours' ? 'Building the workbook…' : 'Also in our layout'}
            </button>
          )}
          {hasRealModel && peerSelection.length > 0 && (
            <button
              type="button"
              onClick={exportPeerSpreading}
              disabled={spreading !== null}
              className={`${LABEL} inline-flex items-center gap-2 border border-line px-3.5 py-2 uppercase tracking-widest text-muted transition-colors hover:border-accent hover:text-ink disabled:opacity-40`}
              title={`Download ${company.ticker} and ${Math.min(peerSelection.length, MAX_PEERS)} peers on identical tabs, with a comparison tab of live formulas`}
            >
              <Download className="h-3.5 w-3.5" />
              {spreading ?? `Spread against ${Math.min(peerSelection.length, MAX_PEERS)} peers`}
            </button>
          )}
          {hasRealModel && (
            <button
              type="button"
              onClick={() => setNerdView('TEMPLATE')}
              className={`${LABEL} inline-flex items-center gap-2 border border-line px-3.5 py-2 uppercase tracking-widest text-muted transition-colors hover:border-accent hover:text-ink`}
              title="Upload your firm's Excel layout once, and every export arrives in it"
            >
              Your template
            </button>
          )}
          {hasRealModel && (
            <button
              type="button"
              onClick={() => setNerdView('SAVED')}
              className={`${LABEL} inline-flex items-center gap-2 border border-line px-3.5 py-2 uppercase tracking-widest text-muted transition-colors hover:border-accent hover:text-ink`}
            >
              Saved models
            </button>
          )}
        </div>
      </section>

      {/* ==================================================================
          THE MEASURES — one tile component, not five copies of its markup.
          Dense by intention: a professional reads the row at a glance.
          ================================================================== */}
      {/* NO STAGGERED ENTRANCE. These five tiles used to fade up one after
          another on every arrival, which is a page performing its own loading
          to a reader who came to read a number. A product loads into a task.
          The tiles are simply there. */}
      {/* A RATIO THE FILING CANNOT SUPPORT IS AN EM DASH WITH THE REASON
          BEHIND IT (`docs/STUDIO_SPEC.md` conflict 6, severity H). These three
          were computed with `?? 0`, so a return on equity nobody could compute
          printed `0.0%` — a claim the company reported nil, which is the one
          thing standing decision 3 forbids. */}
      <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {(bankModel
          ? [
              { label: 'Market cap', value: company.marketCapStr },
              { label: ratioLabel('Return on equity'), value: ratioTile('roePct') },
              { label: ratioLabel('Return on assets'), value: ratioTile('roaPct') },
              {
                label: 'Price / book',
                value:
                  bankModel.bookPerShare > 0
                    ? `${(displayPrice / bankModel.bookPerShare).toFixed(2)}x`
                    : '—',
              },
              {
                label: 'Model P / B',
                value:
                  typeof bankModel.impliedPriceToBook === 'number'
                    ? `${bankModel.impliedPriceToBook.toFixed(2)}x`
                    : '—',
              },
            ]
          : [
              { label: 'Market cap', value: company.marketCapStr },
              { label: ratioLabel('Return on equity'), value: ratioTile('roePct') },
              { label: ratioLabel('Return on assets'), value: ratioTile('roaPct') },
              { label: ratioLabel('Operating margin'), value: ratioTile('opMarginPct') },
              { label: 'Net debt / EBITDA', value: company.netDebtEbitda },
            ]
        ).map((tile) => (
          <MetricTile key={tile.label} label={tile.label} value={tile.value} />
        ))}
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
      <div className="sticky top-[65px] z-40 -mx-6 lg:-mx-12 px-6 lg:px-12 mb-8 bg-[#0B0B0D] border-y border-[#222228]">
        <div className="flex flex-wrap items-center gap-x-1 gap-y-1 py-2.5">
          {/* THE CONTENTS OF THIS VALUATION, every section of it.
              The bar used to carry FIVE entries written out by hand, which
              went stale the moment a section was added: the market approach,
              the asset approach, how much lies beyond the forecast and what
              the source does not give us were all on the screen and none of
              them was in the list. It is built from the sections that render
              now, so the two cannot disagree. */}
          <ValuationContents entries={contentsEntries} />

          <span className="mx-2 h-4 w-px bg-[#222228]" aria-hidden="true" />

          <button
            type="button"
            onClick={() => setNerdView('BATCH')}
            className="font-figure text-[11px] uppercase tracking-widest px-3 py-2 border border-[#8B1E1E] text-[#F2F0EA] bg-[#8B1E1E]/15 hover:bg-[#8B1E1E]/35 whitespace-nowrap transition-colors"
          >
            Model a list
          </button>
        </div>
      </div>

      {/* Live News Ticker Marquee */}
      <div className="hairline-border border bg-[#0B0B0D] py-3 px-4 overflow-hidden mb-8 relative flex items-center shadow-inner">
      <div className="font-figure text-[11px] text-[#8B1E1E] uppercase tracking-widest font-bold shrink-0 border-r hairline-border-r pr-4 mr-4 flex items-center gap-2">
          <Activity className="w-3.5 h-3.5 animate-pulse" />
          <span>NEWS DISPATCH:</span>
        </div>
        {/* THE TICKER ONLY TICKS WHEN IT HAS SOMEWHERE TO GO (`KI-25`).

            The strip used to be animated unconditionally from translateX(0) to
            translateX(-100%). That is a ticker when the headlines are wider
            than the window and a fault when they are not: the text fits, needs
            no scrolling, and is dragged off the left edge anyway until nothing
            is left. Measured at 1440px, the strip was 730px inside a 1117px
            window — 387px to spare — and still travelled to -730px.

            So the strip is measured against its window and the animation is
            only applied when the first copy is wider. When it does run, the
            content is DUPLICATED and the translation is -50%: two identical
            copies moved by exactly one copy's width loop seamlessly, which
            also removes the blank gap the -100% version left before restarting.
            The duplicate is aria-hidden, so a screen reader hears the
            headlines once. */}
        <div ref={marquee.window} className="overflow-hidden relative w-full">
          {newsToShow.length === 0 ? (
            <span className="font-sans text-[13px] leading-snug text-[#8A8A8F]">
              {newsLoading ? 'Loading the news…' : 'No recent headlines found for this company.'}
            </span>
          ) : (
          <div
            data-ticker-strip
            data-scrolling={marquee.scrolling ? 'true' : 'false'}
            className={marquee.scrolling ? 'mg-marquee' : 'inline-flex'}
          >
          <div ref={marquee.content} className="mg-marquee-copy flex gap-12 font-figure text-xs text-[#A1A1AA]">
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
          {marquee.scrolling && (
            <div aria-hidden="true" className="mg-marquee-copy flex gap-12 font-figure text-xs text-[#A1A1AA]">
              {newsToShow.map((news) => (
                <span key={`echo-${news.id}`} className="inline-flex items-center gap-2">
                  <span className="text-[#8B1E1E] font-semibold tracking-wider">[{news.time}]</span>
                  <span className="text-[#F2F0EA] font-medium tracking-wide">{news.headline}</span>
                  <span className="text-[#8A8A8F] text-[10px] tracking-widest uppercase">({news.source})</span>
                </span>
              ))}
            </div>
          )}
          </div>
          )}
        </div>
      </div>

      {/* Ratios come BEFORE the charts. A reader who has just been given a
          value asks what kind of business produced it, and the ratios answer
          that in words. The charts answer questions they have not asked yet. */}
      <div id="ratios" className="scroll-mt-24 mb-10">
        <RatioBand
          reported={ratioData.reported as any}
          forecast={ratioData.forecast as any}
        />
      </div>

      {/* Analytics Row (3 Columns: Rev Trend Bar Chart, DCF Sensitivity Heatmap, Health Radar) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
        
        {/* Card 1: revenue and the margin, each on its own axis.

            FOUR THINGS WERE WRONG WITH IT (`docs/STUDIO_SPEC_ADDENDUM.md` G4,
            severity H). The bar heights did not read as the values — FY26 was
            1.33x FY25 on the screen against 1.65x by value, because every bar
            animated in on its own delay and a screenshot catches them part
            way. There were NO AXES AND NO VALUES, so a reader could only
            compare shapes. The bars and the margin line were BOTH OXBLOOD,
            which VISUAL_SYSTEM 3.2 reserves for the one thing a screen exists
            for — and oxblood does not carry historical data. And the legend
            asked a reader to tell two similar red marks apart.

            So: one scale from zero, printed on the left; the margin on its own
            axis, printed on the right; every bar labelled with its own figure;
            one draw-in for the whole chart rather than a stagger per bar; the
            bars in the panel's own ground and the margin line the chart's
            series colour. */}
        <div className="bg-panel border border-line p-6 flex flex-col min-h-[360px]">
          {/* HEADROOM FOR THE TALLEST BAR'S FIGURE (2026-11-13).
              Each bar's figure sits just above the bar, so the tallest one —
              which by definition reaches the top of the plot — printed into
              the "$ bn · as filed" note on the same line as the title.
              THE BARS ARE NOT SCALED DOWN TO MAKE ROOM: that is exactly the
              G4 trap, where a height stops being its own percentage of the
              scale. The whole chart moves down instead, so every bar keeps
              its proportion and the figure has somewhere to go. */}
          <div className="mb-8 flex items-baseline justify-between" data-revenue-head>
            <span className="text-[13px] font-medium text-muted">Revenue and the margin it earns</span>
            <span className="text-[13px] text-quiet" data-revenue-units>
              {company.currencySymbol} bn · as filed
            </span>
          </div>

          {(() => {
            const revValues = historicals.revenue.filter((x): x is number => typeof x === 'number');
            // ONE SCALE, FROM ZERO. A bar chart whose baseline is not zero
            // misstates every comparison a reader makes by eye.
            const maxRev = revValues.length ? Math.max(...revValues, 0) : 0;
            const margins = historicals.ebitdaMargin.filter(
              (x): x is number => typeof x === 'number'
            );
            const maxMargin = margins.length ? Math.max(...margins, 0) : 0;
            // The margin axis is rounded up to a round number so its ticks are
            // readable, and never to nothing.
            const marginTop = Math.max(5, Math.ceil(maxMargin / 5) * 5);
            const bn = (v: number) => `${(v / 1000).toFixed(v / 1000 >= 100 ? 0 : 1)}`;
            return (
              <>
                <div className="flex gap-2" data-revenue-chart>
                  {/* LEFT AXIS: the scale the bars are drawn on. */}
                  <div className="flex w-10 shrink-0 flex-col justify-between py-1 text-right font-figure text-[13px] text-quiet">
                    <span>{maxRev > 0 ? bn(maxRev) : '0'}</span>
                    <span>{maxRev > 0 ? bn(maxRev / 2) : ''}</span>
                    <span>0</span>
                  </div>

                  <div className="relative h-52 flex-1 border-b border-l border-line">
                    {/* The halfway rule, so a reader can read a height off it. */}
                    <div className="absolute inset-x-0 top-1/2 border-t border-line/60" aria-hidden="true" />
                    <div className="flex h-full items-end justify-between gap-3 px-2">
                      {historicals.years.map((yr, idx) => {
                        const thisRev = historicals.revenue[idx];
                        const heightPct =
                          maxRev > 0 && typeof thisRev === 'number' ? (thisRev / maxRev) * 100 : 0;
                        const margin = historicals.ebitdaMargin[idx];
                        return (
                          <div
                            key={yr}
                            className="relative h-full flex-1"
                            data-revenue-bar={String(yr)}
                            data-revenue-value={typeof thisRev === 'number' ? thisRev : ''}
                            data-revenue-height={heightPct.toFixed(4)}
                          >
                            {/* THE BAR AND ITS FIGURE ARE BOTH OUT OF THE FLOW,
                                which is not a styling preference: a bar laid out
                                as a flex child is SHRUNK to make room for the
                                figure above it, and only the tallest bar is
                                shrunk, so the heights stop being the values.
                                That is G4 itself, and this check caught it a
                                second time in the fix for it — the tallest bar
                                measured 13.2% short of its own scale. Absolute
                                positioning makes each height exactly its own
                                percentage of the column. */}
                            <motion.div
                              initial={{ height: 0 }}
                              animate={{ height: `${heightPct}%` }}
                              /* ONE DRAW FOR THE WHOLE CHART (C6, decision V3):
                                 400ms, no per-bar delay. The stagger is what
                                 made a screenshot of this chart disagree with
                                 its own figures. */
                              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                              className="absolute inset-x-0 bottom-0 bg-line"
                              data-revenue-fill={String(yr)}
                            />
                            {/* THE FIGURE ON THE BAR, so the chart can be read
                                without measuring it. */}
                            <span
                              className="absolute inset-x-0 text-center font-figure text-[13px] text-ink"
                              data-revenue-figure={String(yr)}
                              style={{
                                bottom: `calc(${heightPct}% + 2px)`,
                                opacity: typeof thisRev === 'number' ? 1 : 0.5,
                              }}
                            >
                              {typeof thisRev === 'number' ? bn(thisRev) : NOT_REPORTED}
                            </span>
                            {typeof margin === 'number' && marginTop > 0 && (
                              /* The margin is a MARK ON ITS OWN AXIS, in the
                                 chart's series colour rather than oxblood. */
                              <div
                                style={{ bottom: `${Math.min(100, (margin / marginTop) * 100)}%` }}
                                className="absolute inset-x-0 h-[2px] bg-accent-text/70"
                                data-margin-mark={String(yr)}
                                data-margin-value={margin}
                                aria-hidden="true"
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* RIGHT AXIS: the margin's own scale, so the two series are
                      never read off one. */}
                  <div className="flex w-8 shrink-0 flex-col justify-between py-1 font-figure text-[13px] text-quiet">
                    <span>{marginTop}%</span>
                    <span>{Math.round(marginTop / 2)}%</span>
                    <span>0%</span>
                  </div>
                </div>

                <div className="mt-1 flex justify-between gap-2 pl-12 pr-8">
                  {historicals.years.map((yr) => (
                    <span key={yr} className="flex-1 text-center font-figure text-[13px] text-quiet">
                      {yr}
                    </span>
                  ))}
                </div>

                <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 pt-3 text-[13px] text-quiet">
                  <span className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 bg-line" aria-hidden="true" /> Revenue, left axis
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="h-[2px] w-3 bg-accent-text/70" aria-hidden="true" /> EBITDA margin, right axis
                  </span>
                </div>
              </>
            );
          })()}
        </div>

        {/* Card 2: DCF Sensitivity Heatmap Matrix */}
        <div className="bg-panel border border-line p-6 flex flex-col justify-between relative min-h-[360px]">
          <div>
            <div className="flex justify-between items-center mb-3">
              {/* SENTENCE CASE, AND THE WORDS A READER USES (STUDIO §4.5).
                  "DCF SENSITIVITY MATRIX" in capitals is three pieces of
                  jargon shouted; the grid is a sensitivity, and the heads
                  below now say what it is a sensitivity to. */}
              <span className="font-figure text-[13px] text-ink font-medium">Sensitivity</span>
              <span className="font-figure text-[12px] text-[#8A8A8F]">
                Discount rate against growth after the forecast
              </span>
            </div>

            {/* THE COLUMN HEADS: the growth rate each column was computed at.
                The grid used to name its axes once, at the foot, as
                "X-Axis: Term Growth (+/-1%)" — which tells a reader what
                VARIES and never what any particular cell IS. A cell is a pair
                of inputs and should be readable as one. */}
            <div className="grid grid-cols-[2.6rem_repeat(5,1fr)] gap-1 mt-3" aria-hidden="true">
              <span />
              {gRange.map((g, i) => (
                <span
                  key={`g-${i}`}
                  data-sensitivity-col={g.toFixed(2)}
                  className="font-figure text-[11px] text-[#8A8A8F] text-center tabular-nums"
                >
                  {g.toFixed(1)}%
                </span>
              ))}
            </div>

            {/* 5x5 Cell Matrix, each row headed by its discount rate */}
            <div className="grid grid-cols-[2.6rem_repeat(5,1fr)] gap-1 my-1 relative">
              {waccRange.map((w, rIdx) => (
                <span
                  key={`w-${rIdx}`}
                  data-sensitivity-row={w.toFixed(2)}
                  className="font-figure text-[11px] text-[#8A8A8F] self-center tabular-nums"
                  style={{ gridColumn: 1, gridRow: rIdx + 1 }}
                >
                  {w.toFixed(1)}%
                </span>
              ))}
              {sensitivityMatrix.map((row, rIdx) =>
                row.map((val, cIdx) => {
                  const currWacc = waccRange[rIdx];
                  const currG = gRange[cIdx];
                  const isCurrentDriver = rIdx === 2 && cIdx === 2;
                  
                  // NOT MEANINGFUL IS NOT THE SAME AS NOT REPORTED. Where
                  // the growth rate reaches the discount rate the perpetuity
                  // formula diverges: there is no value at those inputs, and
                  // the cell says so in the one notation that means it
                  // (`n.m.`, TABLES D4 as scoped by VISUAL_BUILD_PLAN C20).
                  // The axis still prints the true input, because the reader
                  // is owed the pair that has no answer.
                  const cellAdmissible = admissible(currWacc, currG);
                  const usable = cellAdmissible && typeof val === 'number' && isFinite(val) && val > 0;
                  // SHADED AGAINST THE PRICE THE GRID'S OWN FIGURES WERE
                  // STRUCK AT, which is the price the whole screen uses (S3).
                  const ratio = usable && struckPrice > 0 ? val / struckPrice : 0;
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
                      <span
                        className="font-figure text-[10px] text-[#F2F0EA] font-semibold tracking-tighter"
                        data-sensitivity-cell={`${currWacc.toFixed(2)}|${currG.toFixed(2)}`}
                        title={
                          cellAdmissible
                            ? undefined
                            : `No value at ${currG.toFixed(1)}% growth against a ${currWacc.toFixed(1)}% discount rate: a perpetuity needs the discount rate above the growth rate.`
                        }
                      >
                        {usable
                          ? `${company.currencySymbol}${Math.round(val)}`
                          : cellAdmissible
                            ? NOT_REPORTED
                            : 'n.m.'}
                      </span>
                    </motion.div>
                  );
                })
              )}
            </div>

            {/* Matrix Cell Inspector */}
            <div className="bg-[#0B0B0D] border hairline-border p-3 font-figure text-[10px] text-[#A1A1AA] tracking-wider flex justify-between items-center min-h-[42px] shadow-inner mt-4">
              {hoveredMatrixCell ? (
                <>
                  <span className="uppercase tracking-widest">
                    WACC: <strong className="text-[#F2F0EA]">{hoveredMatrixCell.wacc.toFixed(1)}%</strong> | Term G:{' '}
                    <strong className="text-[#F2F0EA]">{hoveredMatrixCell.g.toFixed(1)}%</strong>
                  </span>
                  <span className="text-[#8B1E1E] font-bold tracking-widest uppercase">
                    Target:{' '}
                    {admissible(hoveredMatrixCell.wacc, hoveredMatrixCell.g) &&
                    typeof hoveredMatrixCell.val === 'number' &&
                    isFinite(hoveredMatrixCell.val)
                      ? `${company.currencySymbol}${hoveredMatrixCell.val.toFixed(2)}`
                      : 'not meaningful: a perpetuity needs the discount rate above the growth rate'}
                  </span>
                </>
              ) : (
                <span className="font-sans text-[13px] normal-case tracking-normal text-[#8A8A8F]">Hover a cell to inspect the valuation at that pair.</span>
              )}
            </div>
          </div>

          {/* The heads print the rates themselves now, so the foot says what
              the grid is FOR rather than repeating its axes in capitals. */}
          <div className="font-figure text-[12px] text-[#8A8A8F] pt-3">
            Down: the discount rate. Across: growth after the forecast.
          </div>
        </div>

        {/* Card 3: the five ratios, as ratios.

            THE SCORE, ITS RADAR AND ITS BADGE WERE HERE (`docs/STUDIO_SPEC.md`
            S2, approved 4 November 2026). Five ratios went in, one shape and
            one oxblood `{n}/100` came out, and three things were wrong with it:
            a score is a verdict rather than a fact (standing decision 6) and
            its thresholds were ours and unsourced; the radar's axes were
            MISLABELLED, so the figure under each label was not that label's
            figure; and a ratio the filing could not support was drawn as the
            worst possible score (standing decision 3).

            What is left is the part a reader can check: each ratio, the figures
            it was struck from, and the formula in words. What a reader should
            make of a current ratio is in the Margin notes. */}
        <div className="bg-panel border border-line p-6 flex flex-col min-h-[360px]">
          <div className="mb-3 flex items-baseline justify-between">
            <span className="text-[13px] font-medium text-muted">Five ratios, as reported</span>
            <span className="text-[13px] text-quiet">
              {company.plainRatios?.asOfYear ? `FY${company.plainRatios.asOfYear}` : 'last reported year'}
            </span>
          </div>

          <div className="flex flex-col gap-px bg-line" data-plain-ratios>
            {(company.plainRatios?.ratios || []).map((ratio) => (
              <div
                key={ratio.key}
                data-plain-ratio={ratio.key}
                className="flex items-baseline justify-between gap-3 bg-panel py-2"
              >
                <span className="min-w-0">
                  <span className="block truncate text-[13px] text-ink">{ratio.label}</span>
                  {/* THE FORMULA, AND NOT A READING OF IT. */}
                  <span className="block truncate text-[13px] text-quiet">{ratio.formula}</span>
                </span>
                <span
                  className="shrink-0 font-figure text-[15px] text-ink"
                  title={ratio.value === null ? ratio.reason ?? undefined : undefined}
                >
                  {ratio.value === null
                    ? NOT_REPORTED
                    : ratio.unit === '%'
                      ? `${ratio.value.toFixed(1)}%`
                      : `${ratio.value.toFixed(2)}x`}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-auto pt-3 text-[13px] leading-relaxed text-quiet">
            Each is the company's own reported figures, divided. Nothing here uses the share price, and
            nothing here is scored: what a ratio is worth depends on the business, which is a judgement
            rather than a figure.
          </div>
        </div>

      </div>

      {/* For a bank, the residual income working replaces the cash flow
          walkthrough, since the cash flow model produced nothing. */}
      {bankModel && (
        <div id="working" className="scroll-mt-24 mb-10">
          <ResidualIncomePanel
            model={bankModel}
            companyName={company.name}
            currencySymbol={company.currencySymbol}
            marketPrice={displayPrice}
          />
        </div>
      )}

      {/* ------------------------------------------------------------------
          THE SECTIONS OF THE VALUATION, in the order STUDIO_SPEC 4.1 sets
          (2026-11-13).

          They used to run: the valuation range, what the price assumes, how
          much of the value lies beyond the forecast, what the source does not
          give us, and then the walkthrough -- with the market and asset
          approaches reachable only as full-screen overlays behind a row of
          buttons, which is to say not on the screen at all.

          The spec's order puts the VALUE first and the WORKING after it: the
          range, the price's own assumptions, then the three approaches, then
          how much of it rests on the part nobody modelled, and the full
          working last. Each is its own panel with its own heading and 24px
          between, because a column of identical bordered boxes is a stack of
          cards rather than a document with parts.
          ------------------------------------------------------------------ */}
      <div className="mb-10 flex flex-col gap-6">
        {/* THE RANGE. Never collapsed: it is the screen's answer. */}
        {dcfResult.applicable !== false && (
          <ValuationSection
            id="football"
            title="Valuation range"
            aside="Each approach side by side, never averaged"
          >
            <FootballField
              bands={fieldBands}
              approaches={summary.approaches}
              marketPrice={displayPrice}
              fiftyTwoWeekHigh={liveQuote?.fiftyTwoWeekHigh ?? company.fiftyTwoWeekHigh}
              fiftyTwoWeekLow={liveQuote?.fiftyTwoWeekLow ?? company.fiftyTwoWeekLow}
              currencySymbol={company.currencySymbol}
            />
          </ValuationSection>
        )}

        {/* WHAT THE PRICE ASSUMES -- the reverse DCF. */}
        {dcfResult.applicable !== false && impliedByPrice && (
          <ValuationSection
            id="implied"
            title="What the price assumes"
            aside="The growth the market is already paying for"
          >
            <ImpliedByPrice result={impliedByPrice} currencySymbol={company.currencySymbol} />
          </ValuationSection>
        )}

        {/* THE THREE APPROACHES, each closed to its headline. They are the
            long ones, and they are what a reader opens deliberately rather
            than scrolls past. NEVER BLENDED (standing decision 4): three
            panels in the order the spec sets, never one combined figure. */}
        {activeSource && (
          <ValuationSection
            id="working"
            title="How it was calculated"
            collapsible
            headline={
              'The discounted cash flow, line by line: the forecast, the ' +
              'discount rate it is brought back at, the terminal value, and ' +
              'the bridge from the business to a value per share.'
            }
          >
            <HowCalculated
              source={activeSource}
              dcfResult={dcfResult}
              drivers={drivers}
              defaults={activeDefaults}
              currencySymbol={company.currencySymbol}
              currency={company.currency}
              unitLabel={activeSource.meta?.unitLabel || `${company.currencySymbol} millions`}
              sourceLabel={
                viewMode === 'ANALYST' && company.engineBacked
                  ? 'Built by hand from the filings, then checked figure by figure against them'
                  : activeSource.meta?.source || company.dataSource || 'the company filings'
              }
              companyName={company.name}
              isDerived={viewMode === 'DERIVED' || !company.engineBacked}
              methods={[
                { label: 'perpetuity growth', value: terminalMethods.perpetuity },
                { label: 'exit multiple', value: terminalMethods.exit },
              ].filter((m) => isNum(m.value)) as { label: string; value: number }[]}
              terminalSplit={terminalMethods.split}
              marketApproach={marketApproach}
              assetApproach={assetApproach}
              recoveryKey={recoveryKey}
              onRecoveryKey={applyRecoveryPreset}
            />
          </ValuationSection>
        )}

        {/* THE MARKET AND ASSET APPROACHES ARE ON THE SCREEN NOW. They were
            reachable only through a full-screen overlay, which meant the two
            cross-checks on the income approach were invisible to anyone who
            did not know to press a button labelled "For the nerds". The
            overlays stay -- they have room for the full tables -- but the
            approach itself belongs beside the value it checks. */}
        {marketApproach && (
          <ValuationSection
            id="market"
            title="Market approach"
            collapsible
            headline="What comparable companies are being paid for, and what that implies per share here."
            aside="A cross-check, not an average"
          >
            <CompsPanel
              companyName={company.name}
              currencySymbol={company.currencySymbol}
              unitLabel={activeSource?.meta?.unitLabel || `${company.currencySymbol} millions`}
              result={marketApproach}
              loading={compsLoading}
              selected={peerSelection}
              onSelected={setSelectedPeers}
              onReset={() => setSelectedPeers(null)}
              fiscalYear={subjectTrailing?.fiscalYear ?? null}
              dcfValuePerShare={terminalMethods.perpetuity ?? dcfResult.targetPrice}
            />
          </ValuationSection>
        )}

        {assetApproach && (
          <ValuationSection
            id="asset"
            title="Asset approach"
            collapsible
            headline="What the company owns, once everything it owes is paid."
            aside="A floor, not a forecast"
          >
            <AssetPanel
              companyName={company.name}
              currencySymbol={company.currencySymbol}
              unitLabel={activeSource?.meta?.unitLabel || `${company.currencySymbol} millions`}
              result={assetApproach}
              rates={recoveryRates}
              presetKey={recoveryKey}
              onPreset={applyRecoveryPreset}
              onRate={setRecoveryRate}
              dcfValuePerShare={terminalMethods.perpetuity ?? dcfResult.targetPrice}
            />
          </ValuationSection>
        )}

        {/* HOW MUCH OF THE VALUE IS THE PART NOBODY MODELLED. NOT
            collapsible: it qualifies the headline figure, and a reader who
            stops here should still know what that figure rests on. */}
        {activeSource && dcfResult.applicable !== false && (
          <ValuationSection
            id="terminal"
            title="How much lies beyond the forecast"
            aside="The part no year of the model covers"
          >
            <TerminalReliancePanel
              reliance={terminalReliance(buildFullModel(activeSource, drivers).dcf, activeSource)}
              currencySymbol={company.currencySymbol}
              value={isNum(dcfResult.targetPrice) && dcfResult.targetPrice > 0 ? dcfResult.targetPrice : null}
            />
          </ValuationSection>
        )}

        {/* WHAT THE SOURCE DOES NOT GIVE US. Collapsible, and the headline
            SAYS HOW MANY rather than hiding the count behind the heading: a
            reader has to be able to tell a company with one gap from a company
            with eleven without opening anything. */}
        <ValuationSection
          id="constraints"
          title="What the source does not give us"
          collapsible
          headline={
            (company.dataConstraints?.length ?? 0) === 0
              ? 'Nothing on this company is missing from the filing in a way that could move a value.'
              : `${company.dataConstraints!.length} ${
                  company.dataConstraints!.length === 1
                    ? 'thing the filing does not publish'
                    : 'things the filing does not publish'
                }, each with the bound on what it could move.`
          }
        >
          <DataConstraintPanel constraints={company.dataConstraints ?? []} />
        </ValuationSection>
      </div>

      {/* ------------------------------------------------------------------
          FOR THE NERDS — the detailed working. Kept as its own section at the
          foot of the page, because that is where a reader who has read
          everything else arrives, and it is what they would want next.
          ------------------------------------------------------------------ */}
      {!bankModel && (
      <section id="nerds" className="scroll-mt-32 border-t border-line pt-8 sm:pt-10 mb-10">
        <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
          <h2 className="font-serif text-xl sm:text-2xl text-[#F2F0EA]">
            For the nerds
          </h2>
          <span className="font-figure text-[10px] tracking-[0.2em] text-[#8A8A8F] uppercase">
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
          <OpenScreen view="COMPS" label="Market approach" strong />
          <OpenScreen view="ASSET" label="Asset approach" strong />
        </div>

        {/* Judgement lives here now rather than in the body of the page. It is
            asked for before the model is built; this is where a reader who has
            since formed a view comes back to change it. */}
        <div className="border-t border-[#222228] mt-6 pt-5">
          <p className="text-[14px] leading-relaxed text-[#8A8A8F] max-w-2xl mb-4">
            A model reads accounts. It cannot read a management team, a
            regulator or a competitor. Put your own judgement through the
            assumptions it belongs in, and the value above will move.
          </p>
          <OpenScreen view="QUALITATIVE" label="Qualitative adjustments" strong />
        </div>
      </section>
      )}

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

      {nerdView === 'ASSET' && (
        <FullScreenPanel
          title={`${company.name} — Asset Approach`}
          subtitle="what it owns, once everything it owes is paid"
          onClose={() => setNerdView(null)}
        >
          <AssetPanel
            companyName={company.name}
            currencySymbol={company.currencySymbol}
            unitLabel={activeSource?.meta?.unitLabel || `${company.currencySymbol} millions`}
            result={assetApproach}
            rates={recoveryRates}
            presetKey={recoveryKey}
            onPreset={applyRecoveryPreset}
            onRate={setRecoveryRate}
            dcfValuePerShare={terminalMethods.perpetuity ?? dcfResult.targetPrice}
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

      {nerdView === 'TEMPLATE' && (
        <FullScreenPanel
          title="Your template, our figures"
          subtitle="upload your firm's layout once, and every export arrives in it"
          onClose={() => {
            setTemplateTick((n) => n + 1);
            setNerdView(null);
          }}
        >
          <HouseTemplatePanel
            companyName={company.name}
            onClose={() => {
              setTemplateTick((n) => n + 1);
              setNerdView(null);
            }}
          />
        </FullScreenPanel>
      )}

      {nerdView === 'BATCH' && (
        <FullScreenPanel
          title="Model a list of companies"
          subtitle="one row per company, sorted by how far the model sits from the market"
          onClose={() => setNerdView(null)}
        >
          <BatchPanel seedTickers={[company.ticker]} />
        </FullScreenPanel>
      )}

      {nerdView === 'COMPS' && (
        <FullScreenPanel
          title={`${company.name} — Comparable Companies`}
          subtitle="the market cross-check on the discounted cash flow"
          onClose={() => setNerdView(null)}
        >
          <CompsPanel
            companyName={company.name}
            currencySymbol={company.currencySymbol}
            unitLabel={activeSource?.meta?.unitLabel || `${company.currencySymbol} millions`}
            result={marketApproach}
            loading={compsLoading}
            selected={peerSelection}
            onSelected={setSelectedPeers}
            onReset={() => setSelectedPeers(null)}
            fiscalYear={subjectTrailing?.fiscalYear ?? null}
            dcfValuePerShare={terminalMethods.perpetuity ?? dcfResult.targetPrice}
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
            judgements={savedJudgements}
            produced={{
              perpetuity: terminalMethods.perpetuity,
              exitMultiple: terminalMethods.exit,
              adjustedEbitda: adjustedEbitdaOf(company),
            }}
            slidersChanged={slidersChanged}
            fetched={company.rawFetched ?? null}
            fallbackRecord={company}
            onRestore={restoreSaved}
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
            verdicts={verdicts}
            onVerdictsChange={setVerdicts}
            appliedVerdicts={appliedVerdicts}
            onApply={(next, chosen) => {
              setAppliedVerdicts(chosen);
              setDrivers(next);
            }}
            onReset={() => {
              setVerdicts({});
              setAppliedVerdicts(null);
              setDrivers(activeDefaults);
            }}
            onClose={() => setNerdView(null)}
            currencySymbol={company.currencySymbol}
            currentValue={terminalMethods.perpetuity ?? dcfResult.targetPrice}
            companyName={company.name}
            profile={company.profile}
          />
        </FullScreenPanel>
      )}

    </section>
  );
};