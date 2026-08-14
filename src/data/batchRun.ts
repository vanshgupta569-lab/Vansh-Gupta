// FILE: src/data/batchRun.ts
//
// Marginalia — batch mode
//
// Model a list of companies in one go and put the answers side by side. This is
// the Monday morning job: an analyst has a universe of thirty names and wants
// to know which of them the model disagrees with the market about, without
// opening thirty tabs.
//
// TWO THINGS IT DELIBERATELY DOES NOT DO
//
//   It does not run them all at once. Two at a time, because every ticker is a
//   live fetch against a free source, and hammering that source with thirty
//   parallel requests is how a free source stops answering.
//
//   It does not hide failures. A ticker that cannot be modelled comes back with
//   the reason, in the same table as the ones that worked. A batch that
//   quietly drops the awkward names is worse than useless: the awkward names
//   are usually the interesting ones.

import { loadCompany } from './autoCompany';
import { calculateDCFFor, defaultDriversFor } from './companies';

export interface BatchRow {
  ticker: string;
  name: string | null;
  currencySymbol: string;
  price: number | null;
  value: number | null;
  premiumPct: number | null;
  method: 'discounted cash flow' | 'residual income' | null;
  sector: string | null;
  error: string | null;
}

const isNum = (v: any): v is number => typeof v === 'number' && isFinite(v);

/** Model one ticker and reduce it to a single comparable row. */
async function runOne(ticker: string): Promise<BatchRow> {
  const base: BatchRow = {
    ticker,
    name: null,
    currencySymbol: '',
    price: null,
    value: null,
    premiumPct: null,
    method: null,
    sector: null,
    error: null,
  };

  try {
    const company = await loadCompany(ticker);
    base.name = company.name;
    base.currencySymbol = company.currencySymbol;
    base.price = isNum(company.price) ? company.price : null;
    base.sector = company.sector || null;

    // A bank is valued on residual income; everything else on cash flow. Which
    // method produced the number travels with it, so a reader never has to
    // guess why two rows are not comparable.
    const bank = (company as any).residualIncome;
    if (bank?.applicable && isNum(bank.valuePerShare)) {
      base.value = bank.valuePerShare;
      base.method = 'residual income';
    } else if ((company as any).modelData) {
      const source = (company as any).modelData;
      const drivers: any = {
        ...company.defaultDrivers,
        ...defaultDriversFor(source),
      };
      const result = calculateDCFFor(source, drivers, base.price);
      if (result.applicable !== false && isNum(result.targetPrice) && result.targetPrice > 0) {
        base.value = result.targetPrice;
        base.method = 'discounted cash flow';
      } else {
        base.error = result.message || 'No value could be produced for this company.';
      }
    } else {
      base.error = 'No model could be built for this company.';
    }

    if (isNum(base.value) && isNum(base.price) && base.value > 0) {
      base.premiumPct = Number(((base.price / base.value - 1) * 100).toFixed(1));
    }
  } catch (error: any) {
    base.error = error?.message || `Could not load ${ticker}.`;
  }

  return base;
}

/**
 * Run a list of tickers, two at a time, calling back after each one so the
 * screen can fill in as it goes rather than sitting blank for a minute.
 */
export async function runBatch(
  tickers: string[],
  onRow: (row: BatchRow, done: number, total: number) => void
): Promise<BatchRow[]> {
  const clean = Array.from(
    new Set(
      tickers
        .map((t) => String(t || '').trim().toUpperCase())
        .filter(Boolean)
    )
  );

  const rows: BatchRow[] = [];
  let done = 0;
  const queue = [...clean];

  const worker = async () => {
    while (queue.length) {
      const ticker = queue.shift();
      if (!ticker) break;
      const row = await runOne(ticker);
      rows.push(row);
      done += 1;
      onRow(row, done, clean.length);
    }
  };

  // Two workers. See the note at the top of this file.
  await Promise.all([worker(), worker()]);

  // Back into the order the user typed them, which is the order they think in.
  rows.sort((a, b) => clean.indexOf(a.ticker) - clean.indexOf(b.ticker));
  return rows;
}

/** The table as a CSV, for anyone who wants it in their own spreadsheet. */
export function batchToCsv(rows: BatchRow[]): string {
  const header = ['Ticker', 'Company', 'Sector', 'Price', 'Model value', 'Premium %', 'Method', 'Note'];
  const escape = (v: any) => {
    const text = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const lines = rows.map((r) =>
    [
      r.ticker,
      r.name ?? '',
      r.sector ?? '',
      isNum(r.price) ? r.price : '',
      isNum(r.value) ? r.value.toFixed(2) : '',
      isNum(r.premiumPct) ? r.premiumPct : '',
      r.method ?? '',
      r.error ?? '',
    ]
      .map(escape)
      .join(',')
  );
  return [header.join(','), ...lines].join('\n');
}

export function downloadBatchCsv(rows: BatchRow[]): void {
  const blob = new Blob([batchToCsv(rows)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `marginalia-batch-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default { runBatch, batchToCsv, downloadBatchCsv };