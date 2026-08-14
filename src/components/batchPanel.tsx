// FILE: src/components/batchPanel.tsx
//
// Marginalia — batch mode, on screen
//
// Paste a list of tickers, get one row per company: what it trades at, what the
// model says, and how far apart those are. Sorted by that gap, because the gap
// is the only reason to run a list rather than a single company.

import React, { useMemo, useState } from 'react';
import { Play, Download } from 'lucide-react';
import { BatchRow, runBatch, downloadBatchCsv } from '../data/batchRun';

type SortKey = 'entered' | 'gap' | 'ticker';

export const BatchPanel: React.FC<{ seedTickers?: string[] }> = ({ seedTickers = [] }) => {
  const [input, setInput] = useState(seedTickers.join(', '));
  const [rows, setRows] = useState<BatchRow[]>([]);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [sortKey, setSortKey] = useState<SortKey>('gap');

  const isNum = (v: any): v is number => typeof v === 'number' && isFinite(v);

  const start = async () => {
    const tickers = input
      .split(/[\s,;\n]+/)
      .map((t) => t.trim())
      .filter(Boolean);
    if (!tickers.length) return;

    setRunning(true);
    setRows([]);
    setProgress({ done: 0, total: tickers.length });

    const collected: BatchRow[] = [];
    await runBatch(tickers, (row, done, total) => {
      collected.push(row);
      setRows([...collected]);
      setProgress({ done, total });
    });
    setRunning(false);
  };

  const sorted = useMemo(() => {
    const copy = [...rows];
    if (sortKey === 'ticker') return copy.sort((a, b) => a.ticker.localeCompare(b.ticker));
    if (sortKey === 'gap') {
      return copy.sort((a, b) => {
        // Rows without a value sink to the bottom rather than sorting as zero.
        const av = isNum(a.premiumPct) ? a.premiumPct : Number.POSITIVE_INFINITY;
        const bv = isNum(b.premiumPct) ? b.premiumPct : Number.POSITIVE_INFINITY;
        return av - bv;
      });
    }
    return copy;
  }, [rows, sortKey]);

  const money = (v: any, symbol: string, dp = 2) =>
    isNum(v)
      ? `${symbol}${v.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp })}`
      : '—';

  return (
    <div className="max-w-5xl">
      <h3 className="font-serif text-xl text-[#F2F0EA] mb-2">Model a list of companies</h3>
      <p className="text-[14px] leading-relaxed text-[#A1A1AA] mb-6 max-w-2xl">
        Paste tickers separated by commas, spaces or new lines. Each one is
        modelled the same way it would be on its own page: cash flow for an
        operating company, residual income for a bank. Two run at a time, so a
        long list takes a while.
      </p>

      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        rows={3}
        placeholder="AAPL, NVDA, MSFT, RELIANCE.NS, HDFCBANK.NS"
        className="w-full bg-[#0B0B0D] border border-[#222228] px-4 py-3 font-mono text-[14px] text-[#F2F0EA] placeholder:text-[#8A8A8F] focus:outline-none focus:border-[#8B1E1E] mb-4"
      />

      <div className="flex flex-wrap items-center gap-3 mb-8">
        <button
          type="button"
          onClick={start}
          disabled={running}
          className="inline-flex items-center gap-2 font-mono text-[13px] uppercase tracking-widest px-4 py-2.5 border border-[#8B1E1E] text-[#F2F0EA] bg-[#8B1E1E]/25 hover:bg-[#8B1E1E]/45 disabled:opacity-40 font-semibold transition-colors"
        >
          <Play className="w-4 h-4" />
          {running ? `Modelling ${progress.done} of ${progress.total}…` : 'Run'}
        </button>

        {rows.length > 0 && !running && (
          <button
            type="button"
            onClick={() => downloadBatchCsv(sorted)}
            className="inline-flex items-center gap-2 font-mono text-[13px] uppercase tracking-widest px-4 py-2.5 border border-[#222228] text-[#8A8A8F] hover:text-[#F2F0EA] transition-colors"
          >
            <Download className="w-4 h-4" />
            Download CSV
          </button>
        )}

        {rows.length > 1 && (
          <div className="flex items-center gap-1 font-mono text-[12px] text-[#8A8A8F]">
            <span className="uppercase tracking-widest mr-1">Sort</span>
            {([
              ['gap', 'by gap'],
              ['entered', 'as entered'],
              ['ticker', 'by ticker'],
            ] as [SortKey, string][]).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setSortKey(key)}
                className={`px-2 py-1 border transition-colors ${
                  sortKey === key
                    ? 'border-[#8B1E1E] text-[#F2F0EA]'
                    : 'border-transparent hover:text-[#F2F0EA]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {rows.length > 0 && (
        <div className="overflow-x-auto mb-6">
          <table className="w-full min-w-[720px] border-collapse">
            <thead>
              <tr className="border-b border-[#222228]">
                {['Company', 'Price', 'Model value', 'Gap', 'Method'].map((h, i) => (
                  <th
                    key={h}
                    className={`font-mono text-[12px] tracking-[0.15em] text-[#8A8A8F] uppercase pb-3 px-3 ${
                      i === 0 ? 'text-left' : 'text-right'
                    }`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((row) => (
                <tr key={row.ticker} className="border-b border-[#222228]/60 align-top">
                  <td className="py-3 px-3">
                    <div className="text-[14px] text-[#F2F0EA]">{row.name || row.ticker}</div>
                    <div className="font-mono text-[12px] text-[#8A8A8F]">{row.ticker}</div>
                    {row.error && (
                      <div className="text-[13px] text-[#8A8A8F] mt-1 max-w-md leading-relaxed">
                        {row.error}
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-[14px] text-[#A1A1AA]">
                    {money(row.price, row.currencySymbol)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-[14px] text-[#F2F0EA]">
                    {money(row.value, row.currencySymbol)}
                  </td>
                  <td
                    className={`py-3 px-3 text-right font-mono text-[14px] ${
                      !isNum(row.premiumPct)
                        ? 'text-[#8A8A8F]'
                        : row.premiumPct > 0
                        ? 'text-[#8B1E1E]'
                        : 'text-emerald-400'
                    }`}
                  >
                    {isNum(row.premiumPct)
                      ? `${row.premiumPct > 0 ? '+' : ''}${row.premiumPct}%`
                      : '—'}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-[12px] text-[#8A8A8F]">
                    {row.method || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {rows.length > 0 && (
        <div className="text-[13px] leading-relaxed text-[#8A8A8F] space-y-2 max-w-2xl border-t border-[#222228] pt-5">
          <p>
            A positive gap means the shares cost more than this model says they
            are worth; a negative gap the reverse. It is not a signal. The model
            runs on default assumptions taken from each company's own filed
            history, and a default assumption is a starting point for an
            argument, not the conclusion of one.
          </p>
          <p>
            Rows valued by different methods are not directly comparable. A bank
            valued on residual income and a manufacturer valued on cash flow are
            answering different questions, and the method is printed on every row
            so the difference is never invisible.
          </p>
        </div>
      )}
    </div>
  );
};

export default BatchPanel;