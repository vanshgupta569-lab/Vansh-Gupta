import React, { useState, useMemo } from 'react';
import { CompanyData, TabType, ValuationDrivers } from '../types';
import { calculateDCF } from '../data/companies';
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

  // Drivers State (initialized per company)
  const [drivers, setDrivers] = useState<ValuationDrivers>(company.defaultDrivers);

  // Update local drivers if ticker changes
  React.useEffect(() => {
    setDrivers(company.defaultDrivers);
  }, [selectedTicker]);

  // Recalculate DCF live
  const dcfResult = useMemo(() => calculateDCF(drivers), [drivers]);

  // Calculate Upside %
  const potentialUpsidePct = useMemo(() => {
    const diff = dcfResult.targetPrice - company.price;
    return Number(((diff / company.price) * 100).toFixed(1));
  }, [dcfResult.targetPrice, company.price]);

  // potentialUpsidePct > 0 → market is below model → DISCOUNT to model
  // potentialUpsidePct < 0 → market is above model → PREMIUM to model
  const premiumDiscountLabel = potentialUpsidePct < 0
    ? `${Math.abs(potentialUpsidePct)}% PREMIUM TO MODEL`
    : `${potentialUpsidePct}% DISCOUNT TO MODEL`;
  const premiumDiscountStyle = potentialUpsidePct < 0
    ? 'bg-rose-950/60 text-rose-300 border-rose-700'
    : 'bg-emerald-950/60 text-emerald-300 border-emerald-700';

  // Preset Scenario Handlers
  const applyPreset = (preset: 'BASE' | 'BULL' | 'BEAR' | 'FORENSIC') => {
    const base = company.defaultDrivers;
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
        const res = calculateDCF({ ...drivers, waccPct: Math.max(4, w), terminalGrowthPct: Math.max(0.5, g) });
        return res.targetPrice;
      })
    );
  }, [drivers]);

  const [hoveredMatrixCell, setHoveredMatrixCell] = useState<{ wacc: number; g: number; val: number } | null>(null);
  const [hoveredBarIndex, setHoveredBarIndex] = useState<number | null>(null);

  return (
    <section id="terminal" className="pt-16 pb-20 max-w-[1440px] mx-auto px-6 lg:px-12">
      {/* Terminal Title & Ticker Selector Bar */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8 gap-4 border-b hairline-border-b pb-6">
        <div>
          <h2 className="font-display text-2xl sm:text-3xl text-[#F2F0EA]">
            Company Specific Analysis
          </h2>
        </div>

        {/* Company Quick Ticker Selector */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[11px] text-[#8A8A8F] mr-2 hidden sm:inline">SELECT TICKER:</span>
          {Object.keys(companies).map((t) => (
            <button
              key={t}
              onClick={() => onSelectTicker(t)}
              className={`font-mono text-xs px-3.5 py-1.5 transition-all cursor-pointer ${
                selectedTicker === t
                  ? 'bg-[#8B1E1E] text-[#F2F0EA] font-semibold border border-[#8B1E1E]'
                  : 'bg-[#111114] text-[#dfbfbc] border hairline-border hover:bg-[#222228]'
              }`}
            >
              {t}
            </button>
          ))}
          <button
            onClick={onOpenDirectory}
            className="font-mono text-xs px-3 py-1.5 bg-transparent border hairline-border text-[#8B1E1E] hover:text-[#F2F0EA] hover:border-[#8B1E1E] transition-colors cursor-pointer ml-2"
          >
            + All Companies
          </button>
        </div>
      </div>

      {/* Primary Header Info Bar */}
      <div className="bg-[#111114] border hairline-border p-6 lg:p-8 mb-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="font-mono text-xs text-[#8A8A8F] border border-[#222228] px-2 py-0.5 uppercase">
                {company.exchange}: {company.ticker}
              </span>
              <span className="font-mono text-xs text-[#8A8A8F]">{company.sector}</span>
              <span className="font-mono text-[11px] text-[#8A8A8F]">ISIN: {company.isin}</span>
            </div>
            <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-medium text-[#F2F0EA]">
              {company.name}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-6">
            <div className="text-left md:text-right border-l md:border-l-0 md:border-r-0 hairline-border-l pl-4 md:pl-0">
              <div className="font-mono text-[11px] text-[#8A8A8F] tracking-wider mb-1">
                LIVE PRICING ({company.currency})
              </div>
              <div className="flex items-baseline gap-3 md:justify-end">
                <span className="font-display text-3xl sm:text-4xl text-[#F2F0EA] font-semibold">
                  {company.currencySymbol}{company.price.toFixed(2)}
                </span>
                <span
                  className={`font-mono text-xs font-semibold flex items-center gap-0.5 px-2 py-0.5 ${
                    company.priceChangePct >= 0 ? 'text-emerald-400 bg-emerald-950/40' : 'text-rose-400 bg-rose-950/40'
                  }`}
                >
                  {company.priceChangePct >= 0 ? '+' : ''}{company.priceChangePct}%
                </span>
              </div>
            </div>

            {/* Model Implied Value & Premium/Discount */}
            <div className="bg-[#0B0B0D] border hairline-border p-3 px-4 text-left md:text-right">
              <div className="font-mono text-[10px] text-[#8A8A8F] tracking-wider uppercase mb-1">
                MODEL IMPLIED VALUE
              </div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="font-display text-2xl text-[#8B1E1E] font-bold">
                  {company.currencySymbol}{dcfResult.targetPrice.toFixed(2)}
                </span>
                <span className={`font-mono text-xs px-2.5 py-0.5 font-semibold uppercase tracking-widest border ${premiumDiscountStyle}`}>
                  {premiumDiscountLabel}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 5 Key Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-6 hairline-border-t">
          <div className="bg-[#0B0B0D] border hairline-border p-4">
            <span className="font-mono text-[10px] text-[#8A8A8F] uppercase block mb-1">Market Cap</span>
            <span className="font-mono text-lg text-[#F2F0EA] font-semibold">{company.marketCapStr}</span>
          </div>

          <div className="bg-[#0B0B0D] border hairline-border p-4">
            <span className="font-mono text-[10px] text-[#8A8A8F] uppercase block mb-1">ROE (LTM)</span>
            <span className="font-mono text-lg text-[#F2F0EA] font-semibold">{company.roePct}%</span>
          </div>

          <div className="bg-[#0B0B0D] border hairline-border p-4">
            <span className="font-mono text-[10px] text-[#8A8A8F] uppercase block mb-1">ROA (LTM)</span>
            <span className="font-mono text-lg text-[#F2F0EA] font-semibold">{company.roaPct}%</span>
          </div>

          <div className="bg-[#0B0B0D] border hairline-border p-4">
            <span className="font-mono text-[10px] text-[#8A8A8F] uppercase block mb-1">Op Margin</span>
            <span className="font-mono text-lg text-[#F2F0EA] font-semibold">{company.opMarginPct}%</span>
          </div>

          <div className="bg-[#0B0B0D] border hairline-border p-4">
            <span className="font-mono text-[10px] text-[#8A8A8F] uppercase block mb-1">Net Debt / EBITDA</span>
            <span className="font-mono text-lg text-[#F2F0EA] font-semibold">{company.netDebtEbitda}</span>
          </div>
        </div>
      </div>

      {/* Live News Ticker Marquee */}
      <div className="hairline-border border bg-[#0B0B0D] py-2.5 px-4 overflow-hidden mb-8 relative flex items-center">
        <div className="font-mono text-[11px] text-[#8B1E1E] uppercase font-bold shrink-0 border-r hairline-border-r pr-4 mr-4 flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5 animate-pulse" />
          <span>NEWS DISPATCH:</span>
        </div>
        <div className="overflow-hidden relative w-full">
          <div className="animate-marquee flex gap-12 font-mono text-xs text-[#dfbfbc]">
            {company.recentNews.map((news) => (
              <span key={news.id} className="inline-flex items-center gap-2">
                <span className="text-[#8B1E1E] font-semibold">[{news.time}]</span>
                <span className="text-[#F2F0EA] font-medium">{news.headline}</span>
                <span className="text-[#8A8A8F] text-[10px]">({news.source})</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Analytics Row (3 Columns: Rev Trend Bar Chart, DCF Sensitivity Heatmap, Health Radar) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
        
        {/* Card 1: Revenue & Margin Trend Bar Chart */}
        <div className="bg-[#111114] border hairline-border p-6 flex flex-col justify-between relative min-h-[360px]">
          <div>
            <div className="flex justify-between items-center mb-4">
              <span className="font-mono text-[11px] text-[#8A8A8F] uppercase tracking-wider font-medium">
                REV & MARGIN TREND
              </span>
              <span className="font-mono text-[10px] text-[#8B1E1E] border border-[#8B1E1E]/40 px-1.5 py-0.5">
                5-YEAR GAAP
              </span>
            </div>

            {/* Custom Bar Visualization */}
            <div className="h-52 flex items-end justify-between gap-3 pt-8 pb-2 px-2 border-b hairline-border-b relative">
              {company.financials.years.map((yr, idx) => {
                const maxRev = Math.max(...company.financials.revenue);
                const revHeightPct = Math.round((company.financials.revenue[idx] / maxRev) * 100);
                const margin = company.financials.ebitdaMargin[idx];

                return (
                  <div
                    key={yr}
                    onMouseEnter={() => setHoveredBarIndex(idx)}
                    onMouseLeave={() => setHoveredBarIndex(null)}
                    className="flex-1 flex flex-col items-center h-full justify-end group cursor-pointer relative"
                  >
                    {/* Hover Inspect Tooltip */}
                    {hoveredBarIndex === idx && (
                      <div className="absolute bottom-full mb-2 bg-[#0B0B0D] border hairline-border p-2 z-20 font-mono text-[10px] text-[#F2F0EA] whitespace-nowrap shadow-xl">
                        <div className="text-[#8B1E1E] font-bold">{yr} Metrics</div>
                        <div>Rev: {company.currencySymbol}{(company.financials.revenue[idx] / 1000).toFixed(1)}B</div>
                        <div>EBITDA Margin: {margin}%</div>
                      </div>
                    )}

                    {/* Red Accent Pin line for EBITDA Margin indicator */}
                    <div
                      style={{ bottom: `${Math.min(95, margin * 2)}%` }}
                      className="absolute w-full h-[2px] bg-[#8B1E1E] z-10 group-hover:scale-y-150 transition-transform"
                    />

                    {/* Revenue Bar */}
                    <div
                      style={{ height: `${revHeightPct}%` }}
                      className="w-full bg-[#222228] group-hover:bg-[#8B1E1E]/40 transition-colors relative"
                    >
                      <div className="absolute top-0 left-0 right-0 h-[2px] bg-[#8B1E1E]" />
                    </div>

                    <span className="font-mono text-[10px] text-[#8A8A8F] mt-2 group-hover:text-[#F2F0EA]">
                      {yr}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex justify-between items-center font-mono text-[10px] text-[#8A8A8F] pt-3">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 bg-[#222228] border border-[#8B1E1E]" /> Revenue
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-0.5 bg-[#8B1E1E]" /> EBITDA Margin %
            </span>
          </div>
        </div>

        {/* Card 2: DCF Sensitivity Heatmap Matrix */}
        <div className="bg-[#111114] border hairline-border p-6 flex flex-col justify-between relative min-h-[360px]">
          <div>
            <div className="flex justify-between items-center mb-3">
              <span className="font-mono text-[11px] text-[#8A8A8F] uppercase tracking-wider font-medium">
                DCF SENSITIVITY MATRIX
              </span>
              <span className="font-mono text-[10px] text-[#8A8A8F]">WACC vs. G%</span>
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
                    <div
                      key={`${rIdx}-${cIdx}`}
                      onMouseEnter={() => setHoveredMatrixCell({ wacc: currWacc, g: currG, val })}
                      onMouseLeave={() => setHoveredMatrixCell(null)}
                      className={`h-9 border border-[#222228] flex items-center justify-center cursor-pointer transition-all ${cellBg} ${
                        isCurrentDriver ? 'ring-1 ring-[#F2F0EA]' : ''
                      }`}
                    >
                      <span className="font-mono text-[10px] text-[#F2F0EA] font-semibold">
                        {company.currencySymbol}{Math.round(val)}
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            {/* Matrix Cell Inspector */}
            <div className="bg-[#0B0B0D] border hairline-border p-2.5 font-mono text-[10px] text-[#dfbfbc] flex justify-between items-center min-h-[38px]">
              {hoveredMatrixCell ? (
                <>
                  <span>
                    WACC: <strong className="text-[#F2F0EA]">{hoveredMatrixCell.wacc.toFixed(1)}%</strong> | Term G:{' '}
                    <strong className="text-[#F2F0EA]">{hoveredMatrixCell.g.toFixed(1)}%</strong>
                  </span>
                  <span className="text-[#8B1E1E] font-bold">
                    Target: {company.currencySymbol}{hoveredMatrixCell.val.toFixed(2)}
                  </span>
                </>
              ) : (
                <span className="text-[#8A8A8F]">Hover matrix cell to inspect valuation sensitivity.</span>
              )}
            </div>
          </div>

          <div className="font-mono text-[10px] text-[#8A8A8F] flex justify-between items-center pt-2">
            <span>Y-Axis: WACC (+/-1%)</span>
            <span>X-Axis: Term Growth (+/-1%)</span>
          </div>
        </div>

        {/* Card 3: Health Score Radar Chart */}
        <div className="bg-[#111114] border hairline-border p-6 flex flex-col justify-between relative min-h-[360px]">
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="font-mono text-[11px] text-[#8A8A8F] uppercase tracking-wider font-medium">
                FINANCIAL HEALTH SCORE
              </span>
              <span className="font-mono text-[12px] text-[#8B1E1E] font-bold border border-[#8B1E1E] px-2 py-0.5">
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

                  return (
                    <polygon
                      points={pts}
                      fill="rgba(139, 30, 30, 0.4)"
                      stroke="#8B1E1E"
                      strokeWidth="2"
                    />
                  );
                })()}
              </svg>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-[10px] text-[#8A8A8F] pt-2 border-t hairline-border-t">
            <div>Bal Sheet: <span className="text-[#F2F0EA]">{company.healthMetrics.balanceSheetStrength}%</span></div>
            <div>Earnings Quality: <span className="text-[#F2F0EA]">{company.healthMetrics.earningsQuality}%</span></div>
            <div>Cash Flow: <span className="text-[#F2F0EA]">{company.healthMetrics.cashFlowCoverage}%</span></div>
            <div>Moat Rating: <span className="text-[#F2F0EA]">{company.healthMetrics.valuationMoat}%</span></div>
          </div>
        </div>

      </div>

      {/* Interactive Terminal Workspace Tabs */}
      <div className="bg-[#111114] border hairline-border p-6 lg:p-8">
        
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
                className={`font-mono text-xs uppercase tracking-wider pb-2 flex items-center gap-2 transition-all cursor-pointer ${
                  isActive
                    ? 'text-[#F2F0EA] font-semibold border-b-2 border-[#8B1E1E]'
                    : 'text-[#8A8A8F] hover:text-[#dfbfbc]'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-[#8B1E1E]' : 'text-[#8A8A8F]'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* TAB 1: HISTORICAL FINANCIALS */}
        {activeTab === 'HISTORICAL' && (
          <div className="overflow-x-auto">
            <div className="flex justify-between items-center mb-4">
              <span className="font-mono text-xs text-[#8A8A8F] uppercase">
                3-Statement GAAP Financial Summary ({company.currency} Millions)
              </span>
              <span className="font-mono text-[10px] text-[#8B1E1E]">AUDITED SEC DATA</span>
            </div>

            <table className="w-full text-left font-mono text-xs border-collapse">
              <thead>
                <tr className="border-b hairline-border-b text-[#8A8A8F] text-[11px] uppercase">
                  <th className="py-3 pr-6 font-medium">Line Item</th>
                  {company.financials.years.map((y) => (
                    <th key={y} className="py-3 px-4 text-right font-medium">
                      {y}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#222228] text-[#F2F0EA]">
                <tr>
                  <td className="py-3 pr-6 font-medium text-[#F2F0EA]">Total Revenue</td>
                  {company.financials.revenue.map((v, i) => (
                    <td key={i} className="py-3 px-4 text-right">
                      {company.currencySymbol}{v.toLocaleString()}
                    </td>
                  ))}
                </tr>

                <tr className="text-[#dfbfbc] bg-[#0B0B0D]/50">
                  <td className="py-2.5 pr-6 pl-3 text-[11px]">Revenue Growth %</td>
                  {company.financials.revenueGrowth.map((v, i) => (
                    <td key={i} className={`py-2.5 px-4 text-right text-[11px] ${v >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {v > 0 ? '+' : ''}{v}%
                    </td>
                  ))}
                </tr>

                <tr>
                  <td className="py-3 pr-6 font-medium">Gross Margin %</td>
                  {company.financials.grossMargin.map((v, i) => (
                    <td key={i} className="py-3 px-4 text-right">
                      {v}%
                    </td>
                  ))}
                </tr>

                <tr>
                  <td className="py-3 pr-6 font-medium">EBITDA Margin %</td>
                  {company.financials.ebitdaMargin.map((v, i) => (
                    <td key={i} className="py-3 px-4 text-right">
                      {v}%
                    </td>
                  ))}
                </tr>

                <tr>
                  <td className="py-3 pr-6 font-medium text-[#F2F0EA]">Net Income</td>
                  {company.financials.netIncome.map((v, i) => (
                    <td key={i} className="py-3 px-4 text-right">
                      {company.currencySymbol}{v.toLocaleString()}
                    </td>
                  ))}
                </tr>

                <tr className="bg-[#0B0B0D]/50">
                  <td className="py-3 pr-6 pl-3 text-[#dfbfbc]">Operating Cash Flow</td>
                  {company.financials.operatingCashFlow.map((v, i) => (
                    <td key={i} className="py-3 px-4 text-right text-[#dfbfbc]">
                      {company.currencySymbol}{v.toLocaleString()}
                    </td>
                  ))}
                </tr>

                <tr>
                  <td className="py-3 pr-6 font-semibold text-[#8B1E1E]">Free Cash Flow (FCF)</td>
                  {company.financials.freeCashFlow.map((v, i) => (
                    <td key={i} className="py-3 px-4 text-right font-semibold text-[#8B1E1E]">
                      {company.currencySymbol}{v.toLocaleString()}
                    </td>
                  ))}
                </tr>

                <tr className="text-[#8A8A8F] text-[11px]">
                  <td className="py-2.5 pr-6">Total Debt</td>
                  {company.financials.totalDebt.map((v, i) => (
                    <td key={i} className="py-2.5 px-4 text-right">
                      {company.currencySymbol}{v.toLocaleString()}
                    </td>
                  ))}
                </tr>

                <tr className="text-[#8A8A8F] text-[11px]">
                  <td className="py-2.5 pr-6">Cash & Equivalents</td>
                  {company.financials.cashAndEquivalents.map((v, i) => (
                    <td key={i} className="py-2.5 px-4 text-right">
                      {company.currencySymbol}{v.toLocaleString()}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 2: FORECASTED FINANCIAL STATEMENTS */}
        {activeTab === 'FORECASTED' && (
          <div className="overflow-x-auto space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#0B0B0D] p-4 border hairline-border">
              <div>
                <span className="font-mono text-xs text-[#dfbfbc] uppercase font-semibold block">
                  5-YEAR PROJECTED 3-STATEMENT MODEL ({company.currency} Millions)
                </span>
                <span className="font-mono text-[10px] text-[#8A8A8F]">
                  Driven live by Driver Assumptions: Revenue Growth ({drivers.revenueGrowthPct}%), Operating Margin ({drivers.operatingMarginPct}%), Tax Rate ({drivers.taxRatePct}%), WACC ({drivers.waccPct}%)
                </span>
              </div>
              <button
                onClick={() => setActiveTab('DRIVERS')}
                className="font-mono text-xs px-3.5 py-1.5 bg-[#8B1E1E] text-[#F2F0EA] hover:bg-[#6a1515] transition-colors cursor-pointer flex items-center gap-1.5 font-semibold whitespace-nowrap"
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Adjust Drivers</span>
              </button>
            </div>

            {/* Projected Financial Statements Table */}
            {(() => {
              const lastRev = company.financials.revenue[company.financials.revenue.length - 1] || 380000;
              const forecastYears = ['2025E', '2026E', '2027E', '2028E', '2029E'];
              
              let currRev = lastRev;
              const projectedRows = forecastYears.map((yr, idx) => {
                currRev *= (1 + drivers.revenueGrowthPct / 100);
                const ebit = currRev * (drivers.operatingMarginPct / 100);
                const tax = ebit * (drivers.taxRatePct / 100);
                const nopat = ebit - tax;
                const capex = currRev * (drivers.capexPctOfRev / 100);
                const nwcChange = currRev * 0.02;
                const fcff = nopat - capex - nwcChange;
                const discountFactor = 1 / Math.pow(1 + drivers.waccPct / 100, idx + 1);
                const pvFcff = fcff * discountFactor;

                return {
                  year: yr,
                  revenue: Math.round(currRev),
                  ebit: Math.round(ebit),
                  tax: Math.round(tax),
                  nopat: Math.round(nopat),
                  capex: Math.round(capex),
                  nwcChange: Math.round(nwcChange),
                  fcff: Math.round(fcff),
                  discountFactor: Number(discountFactor.toFixed(3)),
                  pvFcff: Math.round(pvFcff),
                };
              });

              return (
                <table className="w-full text-left font-mono text-xs border-collapse">
                  <thead>
                    <tr className="border-b hairline-border-b text-[#8A8A8F] text-[11px] uppercase">
                      <th className="py-3 pr-6 font-medium">Forecasted Line Item</th>
                      {projectedRows.map((row) => (
                        <th key={row.year} className="py-3 px-4 text-right font-medium text-[#8B1E1E]">
                          {row.year}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#222228] text-[#F2F0EA]">
                    <tr>
                      <td className="py-3 pr-6 font-medium text-[#F2F0EA]">Forecasted Revenue</td>
                      {projectedRows.map((r, i) => (
                        <td key={i} className="py-3 px-4 text-right font-bold text-[#F2F0EA]">
                          {company.currencySymbol}{r.revenue.toLocaleString()}
                        </td>
                      ))}
                    </tr>

                    <tr className="text-[#dfbfbc] bg-[#0B0B0D]/50">
                      <td className="py-2.5 pr-6 pl-3 text-[11px]">Revenue Growth %</td>
                      {projectedRows.map((r, i) => (
                        <td key={i} className="py-2.5 px-4 text-right text-[11px] text-emerald-400 font-semibold">
                          +{drivers.revenueGrowthPct}%
                        </td>
                      ))}
                    </tr>

                    <tr>
                      <td className="py-3 pr-6 font-medium">Operating Income (EBIT)</td>
                      {projectedRows.map((r, i) => (
                        <td key={i} className="py-3 px-4 text-right">
                          {company.currencySymbol}{r.ebit.toLocaleString()}
                        </td>
                      ))}
                    </tr>

                    <tr className="text-[#dfbfbc] bg-[#0B0B0D]/50">
                      <td className="py-2.5 pr-6 pl-3 text-[11px]">Operating Margin %</td>
                      {projectedRows.map((r, i) => (
                        <td key={i} className="py-2.5 px-4 text-right text-[11px]">
                          {drivers.operatingMarginPct}%
                        </td>
                      ))}
                    </tr>

                    <tr>
                      <td className="py-2.5 pr-6 text-[#8A8A8F]">Provision for Taxes ({drivers.taxRatePct}%)</td>
                      {projectedRows.map((r, i) => (
                        <td key={i} className="py-2.5 px-4 text-right text-[#8A8A8F]">
                          ({company.currencySymbol}{r.tax.toLocaleString()})
                        </td>
                      ))}
                    </tr>

                    <tr className="font-semibold bg-[#0B0B0D]/30">
                      <td className="py-3 pr-6 text-[#F2F0EA]">NOPAT (Net Operating Profit After Tax)</td>
                      {projectedRows.map((r, i) => (
                        <td key={i} className="py-3 px-4 text-right text-[#F2F0EA]">
                          {company.currencySymbol}{r.nopat.toLocaleString()}
                        </td>
                      ))}
                    </tr>

                    <tr className="text-[#8A8A8F] text-[11px]">
                      <td className="py-2.5 pr-6 pl-3">Less: Capital Expenditures ({drivers.capexPctOfRev}%)</td>
                      {projectedRows.map((r, i) => (
                        <td key={i} className="py-2.5 px-4 text-right">
                          ({company.currencySymbol}{r.capex.toLocaleString()})
                        </td>
                      ))}
                    </tr>

                    <tr className="text-[#8A8A8F] text-[11px]">
                      <td className="py-2.5 pr-6 pl-3">Less: Change in Net Working Capital (2%)</td>
                      {projectedRows.map((r, i) => (
                        <td key={i} className="py-2.5 px-4 text-right">
                          ({company.currencySymbol}{r.nwcChange.toLocaleString()})
                        </td>
                      ))}
                    </tr>

                    <tr className="bg-[#8B1E1E]/10 border-t-2 border-[#8B1E1E]">
                      <td className="py-3 pr-6 font-bold text-[#8B1E1E]">Unlevered Free Cash Flow (FCFF)</td>
                      {projectedRows.map((r, i) => (
                        <td key={i} className="py-3 px-4 text-right font-bold text-[#8B1E1E]">
                          {company.currencySymbol}{r.fcff.toLocaleString()}
                        </td>
                      ))}
                    </tr>

                    <tr className="text-[#8A8A8F] text-[10px]">
                      <td className="py-2 pr-6">Discount Factor (WACC = {drivers.waccPct}%)</td>
                      {projectedRows.map((r, i) => (
                        <td key={i} className="py-2 px-4 text-right">
                          {r.discountFactor}
                        </td>
                      ))}
                    </tr>

                    <tr className="font-semibold bg-[#111114]">
                      <td className="py-3 pr-6 text-[#F2F0EA]">Present Value of FCFF</td>
                      {projectedRows.map((r, i) => (
                        <td key={i} className="py-3 px-4 text-right text-[#F2F0EA]">
                          {company.currencySymbol}{r.pvFcff.toLocaleString()}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              );
            })()}
          </div>
        )}

        {/* TAB 2: DRIVER ASSUMPTIONS */}
        {activeTab === 'DRIVERS' && (
          <div className="space-y-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#0B0B0D] p-4 border hairline-border">
              <span className="font-mono text-xs text-[#dfbfbc] uppercase font-medium">
                SCENARIO PRESETS:
              </span>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => applyPreset('BASE')}
                  className="font-mono text-xs px-3 py-1 bg-[#222228] text-[#F2F0EA] hover:bg-[#8B1E1E] transition-colors cursor-pointer"
                >
                  Reset Base Case
                </button>
                <button
                  onClick={() => applyPreset('BULL')}
                  className="font-mono text-xs px-3 py-1 bg-emerald-950/60 border border-emerald-700 text-emerald-300 hover:bg-emerald-900 transition-colors cursor-pointer"
                >
                  Bull Case (+30% Growth)
                </button>
                <button
                  onClick={() => applyPreset('BEAR')}
                  className="font-mono text-xs px-3 py-1 bg-rose-950/60 border border-rose-700 text-rose-300 hover:bg-rose-900 transition-colors cursor-pointer"
                >
                  Bear Case (-40% Growth)
                </button>
                <button
                  onClick={() => applyPreset('FORENSIC')}
                  className="font-mono text-xs px-3 py-1 bg-[#8B1E1E]/40 border border-[#8B1E1E] text-[#F2F0EA] hover:bg-[#8B1E1E] transition-colors cursor-pointer"
                >
                  Forensic Stress Test
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Slider 1: Revenue Growth % */}
              <div className="bg-[#0B0B0D] border hairline-border p-5 space-y-3">
                <div className="flex justify-between items-center font-mono text-xs">
                  <label className="text-[#8A8A8F] uppercase">Revenue Growth %</label>
                  <span className="text-[#8B1E1E] font-bold text-base">{drivers.revenueGrowthPct}%</span>
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
                <p className="font-mono text-[10px] text-[#8A8A8F]">
                  5-Year CAGR assumption driving explicit cash flow growth.
                </p>
              </div>

              {/* Slider 2: Operating Margin % */}
              <div className="bg-[#0B0B0D] border hairline-border p-5 space-y-3">
                <div className="flex justify-between items-center font-mono text-xs">
                  <label className="text-[#8A8A8F] uppercase">Operating Margin %</label>
                  <span className="text-[#8B1E1E] font-bold text-base">{drivers.operatingMarginPct}%</span>
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
                <p className="font-mono text-[10px] text-[#8A8A8F]">
                  Target EBIT margin after non-GAAP footnote reconciliation.
                </p>
              </div>

              {/* Slider 3: Tax Rate % */}
              <div className="bg-[#0B0B0D] border hairline-border p-5 space-y-3">
                <div className="flex justify-between items-center font-mono text-xs">
                  <label className="text-[#8A8A8F] uppercase">Effective Tax Rate %</label>
                  <span className="text-[#F2F0EA] font-bold text-base">{drivers.taxRatePct}%</span>
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
                <p className="font-mono text-[10px] text-[#8A8A8F]">
                  Effective cash tax rate adjusted for R&D credits.
                </p>
              </div>

              {/* Slider 4: CapEx % of Revenue */}
              <div className="bg-[#0B0B0D] border hairline-border p-5 space-y-3">
                <div className="flex justify-between items-center font-mono text-xs">
                  <label className="text-[#8A8A8F] uppercase">CapEx % of Revenue</label>
                  <span className="text-[#F2F0EA] font-bold text-base">{drivers.capexPctOfRev}%</span>
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
                <p className="font-mono text-[10px] text-[#8A8A8F]">
                  Capital expenditures required to sustain projected growth.
                </p>
              </div>

              {/* Slider 5: WACC % */}
              <div className="bg-[#0B0B0D] border hairline-border p-5 space-y-3">
                <div className="flex justify-between items-center font-mono text-xs">
                  <label className="text-[#8A8A8F] uppercase">WACC % (Discount Rate)</label>
                  <span className="text-[#8B1E1E] font-bold text-base">{drivers.waccPct}%</span>
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
                <p className="font-mono text-[10px] text-[#8A8A8F]">
                  Weighted Average Cost of Capital risk hurdle.
                </p>
              </div>

              {/* Slider 6: Terminal Growth Rate % */}
              <div className="bg-[#0B0B0D] border hairline-border p-5 space-y-3">
                <div className="flex justify-between items-center font-mono text-xs">
                  <label className="text-[#8A8A8F] uppercase">Terminal Growth Rate %</label>
                  <span className="text-[#F2F0EA] font-bold text-base">{drivers.terminalGrowthPct}%</span>
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
                <p className="font-mono text-[10px] text-[#8A8A8F]">
                  Perpetual long-term GDP growth rate benchmark.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: DCF MODEL OUTPUT */}
        {activeTab === 'DCF_OUTPUT' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
            
            {/* Left Inputs Summary */}
            <div className="lg:col-span-5 flex flex-col justify-between space-y-6">
              <div className="bg-[#0B0B0D] border hairline-border p-6 space-y-4">
                <div className="font-mono text-xs text-[#8A8A8F] uppercase border-b hairline-border-b pb-2 flex justify-between">
                  <span>ACTIVE MODEL PARAMETERS</span>
                  <span className="text-[#8B1E1E]">LIVE STATE</span>
                </div>

                <div className="grid grid-cols-2 gap-4 font-mono text-xs">
                  <div>
                    <span className="text-[#8A8A8F] block text-[10px]">REVENUE GROWTH %</span>
                    <span className="text-[#F2F0EA] font-bold text-base">{drivers.revenueGrowthPct}%</span>
                  </div>

                  <div>
                    <span className="text-[#8A8A8F] block text-[10px]">TAX RATE %</span>
                    <span className="text-[#F2F0EA] font-bold text-base">{drivers.taxRatePct}%</span>
                  </div>

                  <div>
                    <span className="text-[#8A8A8F] block text-[10px]">CAPEX %</span>
                    <span className="text-[#F2F0EA] font-bold text-base">{drivers.capexPctOfRev}%</span>
                  </div>

                  <div>
                    <span className="text-[#8A8A8F] block text-[10px]">WACC %</span>
                    <span className="text-[#8B1E1E] font-bold text-base">{drivers.waccPct}%</span>
                  </div>

                  <div>
                    <span className="text-[#8A8A8F] block text-[10px]">OP MARGIN %</span>
                    <span className="text-[#F2F0EA] font-bold text-base">{drivers.operatingMarginPct}%</span>
                  </div>

                  <div>
                    <span className="text-[#8A8A8F] block text-[10px]">TERMINAL G %</span>
                    <span className="text-[#F2F0EA] font-bold text-base">{drivers.terminalGrowthPct}%</span>
                  </div>
                </div>

                <button
                  onClick={() => setActiveTab('DRIVERS')}
                  className="w-full mt-2 font-mono text-xs bg-[#222228] text-[#F2F0EA] py-2 uppercase hover:bg-[#8B1E1E] transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Adjust Assumptions</span>
                </button>
              </div>

              {/* Cash Flow Bridge Breakdown */}
              <div className="bg-[#0B0B0D] border hairline-border p-6 space-y-3 font-mono text-xs">
                <div className="text-[#8A8A8F] uppercase text-[10px] border-b hairline-border-b pb-2">
                  VALUATION BRIDGE COMPONENTS
                </div>
                <div className="flex justify-between text-[#dfbfbc]">
                  <span>PV of Explicit 5-Yr Cash Flows:</span>
                  <span className="text-[#F2F0EA]">{company.currencySymbol}{dcfResult.pvExplicitFCF.toLocaleString()}B</span>
                </div>
                <div className="flex justify-between text-[#dfbfbc]">
                  <span>PV of Terminal Value:</span>
                  <span className="text-[#F2F0EA]">{company.currencySymbol}{dcfResult.pvTerminalValue.toLocaleString()}B</span>
                </div>
                <div className="flex justify-between text-[#8A8A8F] text-[11px] pt-2 border-t hairline-border-t">
                  <span>Terminal Share of Enterprise Value:</span>
                  <span>
                    {Math.round(
                      (dcfResult.pvTerminalValue / (dcfResult.pvExplicitFCF + dcfResult.pvTerminalValue)) * 100
                    )}
                    %
                  </span>
                </div>
              </div>
            </div>

            {/* Right Output Valuation Panel */}
            <div className="lg:col-span-7 bg-[#0B0B0D] border hairline-border p-8 flex flex-col justify-between space-y-8">
              <div>
                <div className="font-mono text-xs text-[#8A8A8F] uppercase tracking-wider mb-3 flex items-center justify-between">
                  <span>MODEL IMPLIED VALUE</span>
                  <span className="text-[#8B1E1E] font-semibold">MARKET vs. MODEL</span>
                </div>

                <div className="flex flex-wrap items-center gap-3.5 mb-6">
                  <div className="font-display text-5xl sm:text-6xl text-[#F2F0EA] font-semibold tracking-tight">
                    {company.currencySymbol}{dcfResult.targetPrice.toFixed(2)}
                  </div>

                  <div
                    className={`font-mono text-xs px-3 py-1.5 font-bold uppercase tracking-wider flex items-center gap-1 ${
                      potentialUpsidePct >= 0 ? 'bg-[#8B1E1E] text-[#F2F0EA]' : 'bg-rose-950 text-rose-300 border border-rose-700'
                    }`}
                  >
                    {potentialUpsidePct >= 0 ? (
                      <>
                        <ArrowUpRight className="w-3.5 h-3.5" />
                        <span>+{potentialUpsidePct}% UPSIDE</span>
                      </>
                    ) : (
                      <>
                        <ArrowDownRight className="w-3.5 h-3.5" />
                        <span>{potentialUpsidePct}% DOWNSIDE</span>
                      </>
                    )}
                  </div>

                  {/* Premium / Discount badge */}
                  <div className={`font-mono text-xs px-3.5 py-1.5 font-semibold uppercase tracking-widest border flex items-center gap-1.5 ${premiumDiscountStyle}`}>
                    <span className="w-2 h-2 rounded-full bg-current" />
                    <span>{premiumDiscountLabel}</span>
                  </div>
                </div>

                {/* Market price vs model implied value */}
                <div className="p-4 border hairline-border bg-[#111114] font-mono text-xs leading-relaxed mb-6 text-[#dfbfbc]">
                  <strong className="block mb-1.5 text-[#F2F0EA] uppercase tracking-wider">
                    MARKET PRICE vs. MODEL IMPLIED VALUE
                  </strong>
                  <p className="leading-relaxed">
                    {company.currencySymbol}{company.price.toFixed(2)} market price ·{' '}
                    {company.currencySymbol}{dcfResult.targetPrice.toFixed(2)} model implied value ·{' '}
                    {potentialUpsidePct < 0
                      ? `market trades ${Math.abs(potentialUpsidePct)}% above this model`
                      : `market trades ${potentialUpsidePct}% below this model`}.
                    {' '}Use the sliders to adjust assumptions and see how the gap changes.
                    This is a gap — not a recommendation.
                  </p>
                </div>

                <p className="font-sans text-xs text-[#8A8A8F] leading-relaxed max-w-lg">
                  Fair value based on 5-year explicit free cash flow projections discounted at {drivers.waccPct}% WACC and {drivers.terminalGrowthPct}% perpetual growth rate.
                </p>
              </div>

              {/* Enterprise Value to Equity Value Ledger Table */}
              <table className="w-full font-mono text-xs border-collapse">
                <tbody>
                  <tr className="border-b hairline-border-b hover:bg-[#111114]">
                    <td className="py-3 text-[#8A8A8F]">Implied Enterprise Value (EV)</td>
                    <td className="py-3 text-right text-[#F2F0EA] font-semibold">
                      {company.currencySymbol}{dcfResult.enterpriseValueBillion.toLocaleString()}B
                    </td>
                  </tr>

                  <tr className="border-b hairline-border-b hover:bg-[#111114]">
                    <td className="py-3 text-[#8A8A8F]">Less: Net Debt / (Plus Net Cash)</td>
                    <td className="py-3 text-right text-[#dfbfbc]">
                      ({company.currencySymbol}{drivers.netDebtBillion}B)
                    </td>
                  </tr>

                  <tr className="border-b hairline-border-b hover:bg-[#111114] bg-[#111114]/50">
                    <td className="py-3 text-[#F2F0EA] font-medium">Implied Equity Value</td>
                    <td className="py-3 text-right text-[#8B1E1E] font-bold text-sm">
                      {company.currencySymbol}{dcfResult.impliedEquityValueBillion.toLocaleString()}B
                    </td>
                  </tr>

                  <tr className="hover:bg-[#111114]">
                    <td className="py-3 text-[#8A8A8F]">Diluted Shares Outstanding</td>
                    <td className="py-3 text-right text-[#dfbfbc]">
                      {drivers.sharesOutstandingBillion} Billion
                    </td>
                  </tr>
                </tbody>
              </table>

              <div className="font-mono text-[10px] text-[#8A8A8F] pt-3 border-t hairline-border-t flex justify-between items-center">
                <span>MARGINALIA DCF ENGINE VER 4.2</span>
                <span className="text-[#8B1E1E]">100% RECALCULATED REAL-TIME</span>
              </div>
            </div>

          </div>
        )}

      </div>
    </section>
  );
};
