// FILE: src/data/peerSpreading.ts
//
// PEER SPREADING: the target and its peers in one file, on identical tabs.
//
// A spreading exercise is what an analyst does before anything else — put the
// companies side by side on the same lines and see which one is different.
// Doing it by hand is a day's work per set, and the reason it is a day's work
// is that every filing names its lines differently and every model is laid out
// differently.
//
// THIS IS ONLY POSSIBLE BECAUSE OF THE CHART OF ACCOUNTS (METHODOLOGY §22a).
// Every company's 3-Statement tab now puts the same line on the same row, so
// `'MSFT'!$I$26` and `'AAPL'!$I$26` are both revenue. The comparison tab is a
// grid of cross-tab formulas rather than a second copy of the numbers: change
// an assumption on a peer's tab and the comparison moves with it, the same rule
// the Assumptions sheet follows.
//
// WHAT IS NOT A FORMULA, and why. A share price and a diluted share count are
// market facts, not filing lines; they appear nowhere else in the workbook, so
// they are stated once on the comparison tab as inputs, dated, in the yellow
// the rest of the file uses for an assumption. Everything computed FROM them —
// market capitalisation, enterprise value, every multiple — is a formula over
// those cells and the peer tabs. Nothing that exists on a tab is copied.
import ExcelJS from 'exceljs';
import { buildWorkbook, MODEL_SHEET_ROWS } from './excelExport';
import { enableIterativeCalculation } from './excelIterativeCalc';

/** Ten peers plus the target. More tabs than this stops being a comparison. */
export const MAX_PEERS = 10;

const MODEL_SHEET = '3-StatementModel';
const OXBLOOD = 'FF8B1E1E';
const SUBHEAD = 'FFE8E8EA';
const WHITE = 'FFFFFFFF';
const BLACK = 'FF000000';
const GREY = 'FF7F7F7F';
const BLUE = 'FF0000CC';
const GREEN = 'FF008000';
const INPUT_FILL = 'FFFFF2CC';
const INPUT_BORDER = 'FFBFBFBF';
const FONT = { name: 'Calibri', size: 11 };

const PCT1 = '0.0%;(0.0%)';
const MULT = '0.0"x";[Red](0.0"x")';
const NUM0 = '#,##0;(#,##0)';
const PLAIN2 = '0.00';

const isNum = (v: any): v is number => typeof v === 'number' && isFinite(v);

/** Column letter for a 1-based column index. */
function L(index: number): string {
  let n = index;
  let out = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

export interface SpreadCompany {
  ticker: string;
  name: string;
  model: any;
  dcf: any;
  source: any;
  currencySymbol: string;
  unitLabel: string;
  /** Market facts, which are not in any filing and so cannot be a formula. */
  price?: number | null;
  priceDate?: string | null;
  dilutedShares?: number | null;
  /** Set where the site declined to put a value on this company. */
  refusal?: string | null;
}

export interface PeerSpreadInput {
  target: SpreadCompany;
  peers: SpreadCompany[];
  /** Stamped on the cover, as on the single-company workbook. */
  modelLabel: string;
}

/**
 * EXCEL'S OWN RULES ON A TAB NAME: 31 characters, and none of : \ / ? * [ ].
 * A ticker almost never breaks them, but `BRK.B` style suffixes and foreign
 * listings do turn up, and a workbook that fails to open is worse than one
 * with a shortened tab.
 */
export function tabNameFor(ticker: string, taken: Set<string>): string {
  let base = String(ticker || '').replace(/[:\\/?*[\]]/g, '-').trim() || 'COMPANY';
  if (base.length > 31) base = base.slice(0, 31);
  let name = base;
  let n = 2;
  while (taken.has(name.toLowerCase())) {
    const suffix = `~${n++}`;
    name = base.slice(0, 31 - suffix.length) + suffix;
  }
  taken.add(name.toLowerCase());
  return name;
}

/** What the comparison tab needs to know about each tab it reads. */
interface TabRef {
  tab: string;
  ticker: string;
  name: string;
  /** The column holding the last REPORTED year on that tab. */
  lastCol: string;
  fiscalYear: number | null;
  periodEnd: string | null;
  currencySymbol: string;
  unitLabel: string;
  refusal: string | null;
  price: number | null;
  priceDate: string | null;
  dilutedShares: number | null;
  isTarget: boolean;
}

/** The last reported period end the engine carries for a company. */
function periodEndOf(company: SpreadCompany): string | null {
  const rows = Array.isArray(company.source?.rawStatements) ? company.source.rawStatements : [];
  const ends = rows.map((r: any) => r?.periodEnd).filter(Boolean);
  if (ends.length) return String(ends[ends.length - 1]).slice(0, 10);
  const alt = Array.isArray(company.source?.statements) ? company.source.statements : [];
  const ends2 = alt.map((r: any) => r?.periodEnd).filter(Boolean);
  return ends2.length ? String(ends2[ends2.length - 1]).slice(0, 10) : null;
}

export async function buildPeerWorkbook(input: PeerSpreadInput): Promise<ExcelJS.Workbook> {
  const { target, modelLabel } = input;
  const peers = (input.peers || []).slice(0, MAX_PEERS);
  const companies = [target, ...peers];

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Marginalia';
  wb.created = new Date();

  // The comparison tab is added first so it opens first, and filled last, once
  // every peer tab exists and its geometry is known.
  const C = wb.addWorksheet('Comparison', {
    views: [{ showGridLines: false, state: 'frozen', xSplit: 3, ySplit: 7 }],
    properties: { tabColor: { argb: OXBLOOD } },
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });

  const taken = new Set<string>(['comparison']);
  const refs: TabRef[] = [];

  for (const company of companies) {
    // THE SAME GENERATOR THE SINGLE-COMPANY FILE USES, which is what makes the
    // rows identical: the chart of accounts is enforced inside it, so a tab
    // that laid its lines out differently would have thrown before reaching
    // here rather than producing a comparison that silently reads the wrong
    // line.
    const single: any = await buildWorkbook({
      model: company.model,
      dcf: company.dcf,
      source: company.source,
      companyName: company.name,
      ticker: company.ticker,
      currencySymbol: company.currencySymbol,
      unitLabel: company.unitLabel,
      modelLabel,
    });
    const src = single.getWorksheet(MODEL_SHEET);
    if (!src) throw new Error(`peer spreading: ${company.ticker} produced no ${MODEL_SHEET} sheet`);

    const tab = tabNameFor(company.ticker, taken);
    const ws = wb.addWorksheet(tab);
    ws.model = { ...src.model, name: tab };
    ws.name = tab;
    ws.properties.tabColor = { argb: company === target ? OXBLOOD : GREY };

    const nH: number = company.model?.nH ?? 0;
    const years: number[] = Array.isArray(company.model?.years) ? company.model.years : [];
    refs.push({
      tab,
      ticker: company.ticker,
      name: company.name,
      lastCol: L(5 + Math.max(0, nH - 1)),
      fiscalYear: nH > 0 && isNum(years[nH - 1]) ? years[nH - 1] : null,
      periodEnd: periodEndOf(company),
      currencySymbol: company.currencySymbol,
      unitLabel: company.unitLabel,
      refusal: company.refusal ?? null,
      price: isNum(company.price) ? company.price : null,
      priceDate: company.priceDate ?? null,
      dilutedShares: isNum(company.dilutedShares) ? company.dilutedShares : null,
      isTarget: company === target,
    });
  }

  writeComparison(C, refs);
  return wb;
}

// ---------------------------------------------------------------------------
// THE COMPARISON TAB
// ---------------------------------------------------------------------------

function writeComparison(C: ExcelJS.Worksheet, refs: TabRef[]) {
  const FIRST = 3; // column C holds the first company
  const col = (i: number) => FIRST + i;
  const last = col(refs.length - 1);

  C.getColumn(1).width = 2;
  C.getColumn(2).width = 46;
  for (let c = FIRST; c <= last + 3; c++) C.getColumn(c).width = 15;

  let r = 1;
  const band = (text: string, fill: string, colour: string) => {
    const row = r++;
    for (let c = 2; c <= last + 2; c++) {
      const cell = C.getCell(row, c);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
      cell.font = { ...FONT, bold: true, color: { argb: colour } };
      if (c === 2) cell.value = text;
    }
    return row;
  };
  const note = (text: string, colour = GREY) => {
    const row = r++;
    const cell = C.getCell(row, 2);
    cell.value = text;
    cell.font = { ...FONT, size: 10, italic: true, color: { argb: colour } };
    return row;
  };

  C.getCell(r, 2).value = 'Peer spreading';
  C.getCell(r, 2).font = { ...FONT, size: 16, bold: true };
  r++;
  C.getCell(r, 2).value =
    `${refs[0].name} (${refs[0].ticker}) and ${refs.length - 1} ` +
    `peer${refs.length - 1 === 1 ? '' : 's'}, on the filings`;
  C.getCell(r, 2).font = { ...FONT, size: 11, italic: true, color: { argb: GREY } };
  r += 2;

  // ---- the heading block: who is in each column ---------------------------
  const headRow = r++;
  C.getCell(headRow, 2).value = 'Company';
  C.getCell(headRow, 2).font = { ...FONT, bold: true };
  refs.forEach((ref, i) => {
    const cell = C.getCell(headRow, col(i));
    cell.value = ref.ticker;
    cell.font = { ...FONT, bold: true, color: { argb: ref.isTarget ? OXBLOOD : BLACK } };
    cell.alignment = { horizontal: 'right' };
  });
  const medianCol = last + 1;
  const spreadCol = last + 2;
  C.getCell(headRow, medianCol).value = 'Median';
  C.getCell(headRow, medianCol).font = { ...FONT, bold: true };
  C.getCell(headRow, medianCol).alignment = { horizontal: 'right' };
  C.getCell(headRow, spreadCol).value = 'High − low';
  C.getCell(headRow, spreadCol).font = { ...FONT, bold: true };
  C.getCell(headRow, spreadCol).alignment = { horizontal: 'right' };

  const sub = (text: string, values: (i: number) => any, fmt?: string) => {
    const row = r++;
    C.getCell(row, 2).value = text;
    C.getCell(row, 2).font = { ...FONT, italic: true, size: 10, color: { argb: GREY } };
    refs.forEach((ref, i) => {
      const cell = C.getCell(row, col(i));
      const v = values(i);
      if (v !== null && v !== undefined) cell.value = v;
      cell.font = { ...FONT, italic: true, size: 10, color: { argb: GREY } };
      cell.alignment = { horizontal: 'right' };
      if (fmt) cell.numFmt = fmt;
    });
    return row;
  };

  sub('Last reported year', (i) => refs[i].fiscalYear ?? '—');
  // DIFFERING YEAR ENDS ARE SHOWN, NOT ALIGNED. See the note at the foot.
  const periodRow = sub('Period ended', (i) => refs[i].periodEnd ?? 'not stated');
  sub('Reported in', (i) => refs[i].unitLabel);
  const refusalRow = sub('Valuation', (i) =>
    refs[i].refusal ? 'refused — see tab' : 'valued'
  );
  C.getRow(refusalRow).eachCell((cell, c) => {
    const i = c - FIRST;
    if (i >= 0 && i < refs.length && refs[i].refusal) {
      cell.font = { ...FONT, italic: true, size: 10, color: { argb: OXBLOOD } };
    }
  });
  r++;

  // ---- market facts, the only inputs on this tab --------------------------
  band('Market facts — the only figures here that are not read from a tab', SUBHEAD, BLACK);
  note(
    'A share price and a share count are not filing lines, so they are stated once here rather than',
    GREY
  );
  note('read from a tab. Every multiple below is a formula over these cells and the tabs.', GREY);

  const input = (row: number, i: number, value: number | null, fmt: string) => {
    const cell = C.getCell(row, col(i));
    if (value !== null) cell.value = value;
    cell.numFmt = fmt;
    cell.font = { ...FONT, color: { argb: BLACK } };
    cell.alignment = { horizontal: 'right' };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: INPUT_FILL } };
    cell.border = {
      top: { style: 'thin', color: { argb: INPUT_BORDER } },
      left: { style: 'thin', color: { argb: INPUT_BORDER } },
      bottom: { style: 'thin', color: { argb: INPUT_BORDER } },
      right: { style: 'thin', color: { argb: INPUT_BORDER } },
    };
  };
  const labelCell = (row: number, text: string, bold = false) => {
    const cell = C.getCell(row, 2);
    cell.value = text;
    cell.font = { ...FONT, bold };
  };

  const priceRow = r++;
  labelCell(priceRow, 'Share price');
  refs.forEach((ref, i) => input(priceRow, i, ref.price, PLAIN2));
  const sharesRow = r++;
  labelCell(sharesRow, 'Diluted shares');
  refs.forEach((ref, i) => input(sharesRow, i, ref.dilutedShares, NUM0));
  note(
    'Priced ' +
      (refs.map((x) => x.priceDate).filter(Boolean)[0] ?? 'on the date each model was built') +
      '. A blank price leaves every multiple in that column blank rather than nil.'
  );
  r++;

  // ---- the lines read across the tabs ------------------------------------
  const cross = (ref: TabRef, key: keyof typeof MODEL_SHEET_ROWS | string) =>
    `'${ref.tab}'!$${ref.lastCol}$${(MODEL_SHEET_ROWS as any)[key]}`;

  /**
   * A LINE OF THE COMPARISON. `formula(ref)` is built per company, so a tab
   * whose last reported year sits in a different column still reads its own
   * last reported year — see the note on fiscal years.
   */
  const metric = (
    name: string,
    formula: (ref: TabRef) => string,
    fmt: string,
    o: { bold?: boolean; indent?: number; median?: boolean } = {}
  ) => {
    const row = r++;
    const cell = C.getCell(row, 2);
    cell.value = name;
    cell.font = { ...FONT, bold: o.bold };
    cell.alignment = { indent: o.indent ?? 1 };
    refs.forEach((ref, i) => {
      const c = C.getCell(row, col(i));
      c.value = { formula: formula(ref) } as any;
      c.numFmt = fmt;
      c.font = { ...FONT, bold: o.bold, color: { argb: GREEN } };
      c.alignment = { horizontal: 'right' };
    });
    if (o.median !== false) {
      const range = `${L(FIRST)}${row}:${L(last)}${row}`;
      const m = C.getCell(row, medianCol);
      m.value = { formula: `IFERROR(MEDIAN(${range}),"")` } as any;
      m.numFmt = fmt;
      m.font = { ...FONT, bold: true, color: { argb: BLUE } };
      m.alignment = { horizontal: 'right' };
      const s = C.getCell(row, spreadCol);
      s.value = { formula: `IFERROR(MAX(${range})-MIN(${range}),"")` } as any;
      s.numFmt = fmt;
      s.font = { ...FONT, color: { argb: BLUE } };
      s.alignment = { horizontal: 'right' };
    }
    return row;
  };

  /** Wrapped so a peer with no figure leaves a blank rather than a zero. */
  const safe = (expr: string) => `IFERROR(${expr},"")`;

  band('Size and growth', OXBLOOD, WHITE);
  metric('Revenue', (p) => safe(cross(p, 'rev')), NUM0, { bold: true });
  metric('Revenue growth, year on year', (p) => safe(cross(p, 'revGrowth')), PCT1);
  metric('EBITDA', (p) => safe(cross(p, 'ebitda')), NUM0);
  metric('Operating profit (EBIT)', (p) => safe(cross(p, 'ebit')), NUM0);
  metric('Net income', (p) => safe(cross(p, 'ni')), NUM0);
  r++;

  band('Margins', OXBLOOD, WHITE);
  metric('Gross margin', (p) => safe(cross(p, 'gm')), PCT1);
  metric('EBITDA margin', (p) => safe(`${cross(p, 'ebitda')}/${cross(p, 'rev')}`), PCT1);
  metric('Operating margin', (p) => safe(`${cross(p, 'ebit')}/${cross(p, 'rev')}`), PCT1);
  metric('Net margin', (p) => safe(`${cross(p, 'ni')}/${cross(p, 'rev')}`), PCT1);
  r++;

  band('Returns', OXBLOOD, WHITE);
  metric('Return on equity', (p) => safe(`${cross(p, 'ni')}/${cross(p, 'bsTe')}`), PCT1);
  metric('Return on assets', (p) => safe(`${cross(p, 'ni')}/${cross(p, 'bsTa')}`), PCT1);
  metric(
    'Return on capital employed',
    (p) => safe(`${cross(p, 'ebit')}/(${cross(p, 'bsTa')}-${cross(p, 'bsAp')}-${cross(p, 'bsAcc')})`),
    PCT1
  );
  r++;

  band('Leverage', OXBLOOD, WHITE);
  const netDebt = (p: TabRef) =>
    `(${cross(p, 'bsDebt')}+${cross(p, 'bsRevolver')}-${cross(p, 'bsCash')})`;
  const netDebtRow = metric('Net debt', (p) => safe(netDebt(p)), NUM0);
  metric('Net debt / EBITDA', (p) => safe(`${netDebt(p)}/${cross(p, 'ebitda')}`), MULT);
  metric('Total liabilities / equity', (p) => safe(`${cross(p, 'bsTl')}/${cross(p, 'bsTe')}`), MULT);
  r++;

  // ---- the multiples, computed here rather than carried in ----------------
  band('Multiples — computed from the market facts above and the tabs', OXBLOOD, WHITE);
  const priceOf = (i: number) => `${L(col(i))}$${priceRow}`;
  const sharesOf = (i: number) => `${L(col(i))}$${sharesRow}`;
  const mcapRow = r;
  const marketMetric = (
    name: string,
    formula: (ref: TabRef, i: number) => string,
    fmt: string,
    o: { bold?: boolean } = {}
  ) => {
    const row = r++;
    const cell = C.getCell(row, 2);
    cell.value = name;
    cell.font = { ...FONT, bold: o.bold };
    cell.alignment = { indent: 1 };
    refs.forEach((ref, i) => {
      const c = C.getCell(row, col(i));
      c.value = { formula: formula(ref, i) } as any;
      c.numFmt = fmt;
      c.font = { ...FONT, bold: o.bold, color: { argb: GREEN } };
      c.alignment = { horizontal: 'right' };
    });
    const range = `${L(FIRST)}${row}:${L(last)}${row}`;
    const m = C.getCell(row, medianCol);
    m.value = { formula: `IFERROR(MEDIAN(${range}),"")` } as any;
    m.numFmt = fmt;
    m.font = { ...FONT, bold: true, color: { argb: BLUE } };
    m.alignment = { horizontal: 'right' };
    const s = C.getCell(row, spreadCol);
    s.value = { formula: `IFERROR(MAX(${range})-MIN(${range}),"")` } as any;
    s.numFmt = fmt;
    s.font = { ...FONT, color: { argb: BLUE } };
    s.alignment = { horizontal: 'right' };
    return row;
  };

  const mcap = (i: number) => `(${priceOf(i)}*${sharesOf(i)})`;
  const marketCapRow = marketMetric(
    'Market capitalisation',
    (_p, i) => safe(mcap(i)),
    NUM0,
    { bold: true }
  );
  const evRow = marketMetric(
    'Enterprise value',
    (p, i) => safe(`${mcap(i)}+${netDebt(p)}`),
    NUM0,
    { bold: true }
  );
  const evRef = (i: number) => `${L(col(i))}$${evRow}`;
  marketMetric('EV / EBITDA', (p, i) => safe(`${evRef(i)}/${cross(p, 'ebitda')}`), MULT);
  marketMetric('EV / revenue', (p, i) => safe(`${evRef(i)}/${cross(p, 'rev')}`), MULT);
  marketMetric(
    'Price / earnings',
    (p, i) => safe(`${mcap(i)}/${cross(p, 'ni')}`),
    MULT
  );
  void marketCapRow;
  void mcapRow;
  void netDebtRow;
  void periodRow;
  r++;

  // ---- what a reader has to know to use this ------------------------------
  band('What this tab does, and what it does not', SUBHEAD, BLACK);
  note('EVERY FIGURE ABOVE IS A LIVE FORMULA over the company tabs, apart from the two rows of market');
  note('facts, which are marked as inputs. Change an assumption on any tab and this tab follows it.');
  note('');
  note('FISCAL YEAR ENDS ARE NOT ALIGNED, AND ARE NOT ADJUSTED. Each column reads that company\'s own');
  note('last reported year from its own tab — the engine carries each company\'s period end, and the');
  note('"Period ended" row above states it. A December filer and a March filer are a quarter apart, and');
  note('calendarising one onto the other would need quarterly filings this site does not read. Where the');
  note('period ends differ, the comparison is of each company\'s most recent full year, which is what a');
  note('spreading exercise compares; it is not a like-for-like snapshot of one date, and a reader');
  note('drawing conclusions across a cyclical turn should look at the dates first.');
  note('');
  note('CURRENCIES ARE NOT CONVERTED. Each tab reports in the currency of its own filings, stated in the');
  note('"Reported in" row. Margins, returns and multiples are ratios and so are comparable across');
  note('currencies; revenue, EBITDA, net debt and market capitalisation are not, and are left in the');
  note('currency filed rather than translated at a rate that would be stale by the time it was read.');
  note('');
  note('A REFUSED COMPANY KEEPS ITS TAB. Where the site declined to put a value on a peer, its reported');
  note('figures are still here and its tab states the refusal: the comparison is of filings, not of');
  note('valuations, and a company the model cannot value is still a company the filings describe.');

  const refused = refs.filter((x) => x.refusal);
  if (refused.length) {
    note('');
    for (const x of refused) {
      note(`${x.ticker}: ${String(x.refusal).slice(0, 150)}`, OXBLOOD);
    }
  }
}


// ---------------------------------------------------------------------------
// GATHERING THE PEERS, AND HANDING THE FILE OVER
// ---------------------------------------------------------------------------

/** What `gatherPeers` could not build, and why, so the caller can say so. */
export interface PeerGatherResult {
  companies: SpreadCompany[];
  missing: { ticker: string; reason: string }[];
}

/**
 * ONE PEER AT A TIME, AND A FAILURE IS NOT FATAL.
 *
 * Each peer needs its own filings, which means its own fetch: the comparison
 * endpoint carries market multiples and nothing a model could be built from.
 * Peers are fetched in sequence rather than all at once, because ten parallel
 * fetches against the filings API is the kind of thing that gets an IP rate
 * limited, and the reader would rather wait than be refused.
 *
 * A peer that cannot be fetched or modelled is REPORTED, not silently dropped:
 * a spread quietly missing two of the ten companies the reader chose is a
 * different comparison from the one they asked for.
 */
export async function gatherPeers(
  tickers: string[],
  load: (ticker: string) => Promise<SpreadCompany | null>
): Promise<PeerGatherResult> {
  const companies: SpreadCompany[] = [];
  const missing: { ticker: string; reason: string }[] = [];
  for (const ticker of tickers.slice(0, MAX_PEERS)) {
    try {
      const c = await load(ticker);
      if (c) companies.push(c);
      else missing.push({ ticker, reason: 'no filings this model could read' });
    } catch (error: any) {
      missing.push({ ticker, reason: String(error?.message || error).slice(0, 120) });
    }
  }
  return { companies, missing };
}

/** The same hand-over the single-company workbook uses, iterative calc and all. */
export async function downloadPeerWorkbook(input: PeerSpreadInput): Promise<void> {
  const wb = await buildPeerWorkbook(input);
  const rawBuffer = await wb.xlsx.writeBuffer();
  const buffer = await enableIterativeCalculation(rawBuffer, {
    iterateCount: 100,
    iterateDelta: 0.001,
  });
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const safe = String(input.target.ticker || 'model').replace(/[^A-Za-z0-9.\-]/g, '');
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Marginalia_${safe}_peer_spreading.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default { buildPeerWorkbook, downloadPeerWorkbook, gatherPeers, MAX_PEERS, tabNameFor };
