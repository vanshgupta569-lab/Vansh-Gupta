// FILE: src/data/houseTemplate.ts
//
// THE HOUSE TEMPLATE: a firm's own layout, filled with our figures.
//
// A firm has a format. It has had it for years, its partners read it without
// thinking, and a model that arrives in somebody else's layout gets re-typed
// into theirs before anyone will look at it. Re-typing is where errors come
// from, so the model that arrives in the wrong format is worse than useless.
//
// THIS IS ONLY POSSIBLE BECAUSE OF THE CHART OF ACCOUNTS (METHODOLOGY §22a).
// A template maps onto a fixed set of lines or it maps onto nothing: if our
// own rows moved with the company, a mapping made against one model would be
// pointing at the wrong lines in the next. The 138 contracted rows are what a
// template is mapped to.
//
// ---------------------------------------------------------------------------
// HOW THE MAPPING IS CAPTURED, AND WHY THAT WAY
// ---------------------------------------------------------------------------
//
// The obvious design is a form: 138 of our lines down one side, a cell picker
// against each. It is also the design that kills the feature. Nobody completes
// a 138-row form to try something, and a feature that has to be earned before
// it can be judged does not get earned.
//
// So the upload does the work and the firm corrects it. We read their file,
// find every text cell that looks like a line name, and match it against the
// names our contract publishes — exactly where it matches exactly, through a
// table of the names analysts actually write where it does not ("Sales",
// "Turnover", "COGS", "SG&A", "PP&E"), and on word overlap where neither does.
// Each proposal carries HOW it was matched, so the firm reviews a short list of
// uncertain ones rather than confirming a hundred obvious ones.
//
// A firm that wants certainty rather than inference can write `{{rev}}` in a
// cell and that is taken as an instruction, above every other rule. That is the
// precise path for whoever wants it, and nobody has to learn a key to begin.
//
// ---------------------------------------------------------------------------
// WHAT IS STORED, WHERE, AND FOR HOW LONG
// ---------------------------------------------------------------------------
//
// The template file and its mapping are held in THIS BROWSER, in IndexedDB,
// and are not sent anywhere. There is no upload in the network sense: the file
// is read by the page, mapped by the page, filled by the page. Marginalia runs
// no server that receives it, so there is nothing of a firm's to leak, subpoena
// or lose, and nothing to delete on request beyond what the firm can delete
// itself from this screen.
//
// It is kept until the firm removes it. `forgetTemplate` deletes the bytes and
// the mapping together; clearing browsing data does the same. Nothing else is
// retained: no copy of the filled output, no record that a template exists.
//
// The one thing this costs is that a template does not follow a reader to
// another device or browser, which is the same trade `savedModels.ts` makes and
// is stated on screen in the same words rather than implied.
import ExcelJS from 'exceljs';
import { MODEL_SHEET_ROWS, MODEL_SHEET_ROW_LABELS } from './excelExport';

const isNum = (v: any): v is number => typeof v === 'number' && isFinite(v);

/** The text a cell we cannot fill carries, so it never reads as a nil. */
export const CANNOT_FILL = 'not reported';

export type MatchKind = 'instruction' | 'exact' | 'synonym' | 'words';

export interface CellRef {
  sheet: string;
  row: number;
  /** The column holding this line's FIRST period. Later periods run rightwards. */
  col: number;
}

export interface MappedLine extends CellRef {
  /** A key of MODEL_SHEET_ROWS. */
  key: string;
  /** Our name for the line. */
  ours: string;
  /** The text found in their template. */
  theirs: string;
  how: MatchKind;
  /** 0..1. Anything below `REVIEW_BELOW` is put in front of the firm. */
  confidence: number;
}

export interface TemplateMapping {
  id: string;
  name: string;
  /** Of the file the mapping was made against, so a revision can be spotted. */
  fingerprint: string;
  createdAt: string;
  updatedAt: string;
  lines: MappedLine[];
  /** How many period columns each sheet has room for, where we could tell. */
  periodColumnsBySheet: Record<string, number | null>;
  /** The widest of those. A line is written only as wide as its own sheet. */
  periodColumns: number | null;
}

/** Anything at or below this is shown for confirmation rather than assumed. */
export const REVIEW_BELOW = 0.9;

// ---------------------------------------------------------------------------
// MATCHING A NAME
// ---------------------------------------------------------------------------

/**
 * Two names are the same line if they are the same words. Punctuation, case,
 * ampersands and the qualifiers our own labels carry ("excluding D&A and SBC")
 * are noise for this purpose: a template that says "Cost of sales" means our
 * "Cost of sales, excluding D&A and SBC", and refusing the match because of a
 * clause we added would make the feature useless on every real template.
 */
export function normaliseLabel(text: string): string {
  return String(text || '')
    .toLowerCase()
    .replace(/’/g, "'")
    .replace(/&/g, ' and ')
    .replace(/[(),:;."'`\/\\\[\]{}]/g, ' ')
    .replace(/\s*[-–—]\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** The clauses our labels add that a firm's template will not repeat. */
const OURS_ONLY = [
  'excluding d and a and sbc',
  'before d and a and sbc',
  'as filed',
  'net of',
];

function coreOf(text: string): string {
  let out = normaliseLabel(text);
  for (const clause of OURS_ONLY) out = out.split(clause).join(' ');
  return out.replace(/\s+/g, ' ').trim();
}

/**
 * WHAT ANALYSTS ACTUALLY WRITE. Every entry here is a name a template uses for
 * a line our contract names differently. It is deliberately a table and not a
 * cleverer algorithm: a wrong guess puts a figure on the wrong line of a
 * partner's model, so the failure has to be something a person can read and
 * correct, not a score to be tuned.
 */
export const SYNONYMS: Record<string, string[]> = {
  rev: ['sales', 'turnover', 'net sales', 'total revenue', 'net revenue', 'total revenues', 'revenues'],
  cogs: ['cogs', 'cost of goods sold', 'cost of revenue', 'cost of sales'],
  gp: ['gross profit', 'gross income'],
  gm: ['gross margin', 'gross margin %', 'gross profit margin'],
  rnd: ['r and d', 'research and development', 'rd expense'],
  sga: ['sg and a', 'selling general and administrative', 'sganda', 'opex', 'operating expenses'],
  daCost: ['d and a', 'depreciation and amortisation', 'depreciation and amortization', 'depreciation', 'dandA'],
  sbcCost: ['sbc', 'stock compensation', 'share based compensation', 'stock based comp'],
  ebit: ['ebit', 'operating income', 'operating profit', 'op income', 'operating profit ebit'],
  ebitda: ['ebitda', 'adjusted ebitda'],
  intExp: ['interest expense', 'finance costs', 'net interest expense'],
  intInc: ['interest income', 'finance income'],
  pbt: ['pbt', 'profit before tax', 'pretax income', 'income before tax', 'ebt', 'pretax profit'],
  tax: ['tax', 'taxes', 'income tax expense', 'provision for income taxes', 'tax expense'],
  taxRate: ['tax rate', 'effective tax rate'],
  ni: ['net income', 'net profit', 'profit after tax', 'pat', 'net earnings', 'earnings'],
  cfo: ['cash from operations', 'operating cash flow', 'cfo', 'cash flow from operations'],
  cfi: ['cash from investing', 'investing cash flow', 'cash flow from investing'],
  cff: ['cash from financing', 'financing cash flow', 'cash flow from financing'],
  bsCash: ['cash', 'cash and equivalents', 'cash and cash equivalents'],
  bsAr: ['receivables', 'accounts receivable', 'trade receivables', 'debtors'],
  bsInv: ['inventory', 'inventories', 'stock'],
  bsPpe: ['ppe', 'property plant and equipment', 'fixed assets', 'net ppe'],
  bsTa: ['total assets'],
  bsAp: ['payables', 'accounts payable', 'trade payables', 'creditors'],
  bsDebt: ['debt', 'long term debt', 'borrowings', 'total debt', 'lt debt'],
  bsRevolver: ['revolver', 'short term debt', 'revolving credit'],
  bsTl: ['total liabilities'],
  bsTe: ['total equity', 'shareholders equity', 'total shareholders equity', 'net assets', 'equity'],
  bsRe: ['retained earnings', 'reserves'],
  ppeCapex: ['capex', 'capital expenditure', 'capital expenditures', 'purchases of ppe'],
};

interface Candidate {
  key: string;
  core: string;
  words: Set<string>;
}

function contractCandidates(): Candidate[] {
  const out: Candidate[] = [];
  for (const key of Object.keys(MODEL_SHEET_ROWS)) {
    const raw = (MODEL_SHEET_ROW_LABELS as any)[key];
    if (raw === undefined) continue;
    const first = Array.isArray(raw) ? raw[0] : raw;
    const core = coreOf(String(first));
    out.push({ key, core, words: new Set(core.split(' ').filter(Boolean)) });
  }
  return out;
}

/** Jaccard overlap, which is enough when the vocabulary is this small. */
function overlap(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const w of a) if (b.has(w)) shared++;
  return shared / (a.size + b.size - shared);
}

export interface NameMatch {
  key: string;
  how: MatchKind;
  confidence: number;
}

/** What line, if any, a piece of template text names. */
export function matchName(text: string, candidates = contractCandidates()): NameMatch | null {
  const raw = String(text || '').trim();
  if (!raw) return null;

  // AN INSTRUCTION BEATS EVERY GUESS.
  const instruction = raw.match(/\{\{\s*([A-Za-z0-9_$]+)\s*\}\}/);
  if (instruction) {
    const key = instruction[1];
    if ((MODEL_SHEET_ROWS as any)[key] !== undefined) {
      return { key, how: 'instruction', confidence: 1 };
    }
    return null;
  }

  const core = coreOf(raw);
  if (!core || core.length < 2) return null;

  for (const c of candidates) if (c.core === core) return { key: c.key, how: 'exact', confidence: 1 };

  for (const [key, names] of Object.entries(SYNONYMS)) {
    if ((MODEL_SHEET_ROWS as any)[key] === undefined) continue;
    for (const n of names) {
      if (coreOf(n) === core) return { key, how: 'synonym', confidence: 0.95 };
    }
  }

  const words = new Set(core.split(' ').filter(Boolean));
  let best: NameMatch | null = null;
  for (const c of candidates) {
    const score = overlap(words, c.words);
    if (score >= 0.6 && (!best || score > best.confidence)) {
      best = { key: c.key, how: 'words', confidence: Number(score.toFixed(2)) };
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// READING A TEMPLATE
// ---------------------------------------------------------------------------

function textOf(value: any): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    if ('richText' in value && Array.isArray((value as any).richText)) {
      return (value as any).richText.map((t: any) => t.text).join('');
    }
    if ('text' in value && typeof (value as any).text === 'string') return (value as any).text;
    if ('result' in value) return '';
  }
  return '';
}

/** A short, stable identifier for the uploaded bytes. */
export async function fingerprintOf(bytes: ArrayBuffer): Promise<string> {
  const view = new Uint8Array(bytes);
  // FNV-1a over the bytes, plus the length. Not a security hash and not used as
  // one: it only has to notice that a file is a different file.
  let h = 0x811c9dc5;
  for (let i = 0; i < view.length; i++) {
    h ^= view[i];
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return `${view.length.toString(36)}-${h.toString(36)}`;
}

export interface Detection {
  mapping: MappedLine[];
  /** Contracted lines their template has nowhere to put. */
  unmapped: { key: string; label: string }[];
  /** Lines proposed with low confidence, for the firm to confirm. */
  review: MappedLine[];
  /** Two template cells that claim the same line of ours. */
  conflicts: { key: string; at: string[] }[];
  /** The widest run of year headings found, per sheet. */
  periodColumnsBySheet: Record<string, number | null>;
  /** The widest of those, for display. A line is capped by ITS OWN sheet. */
  periodColumns: number | null;
  sheets: string[];
}

const A1 = (row: number, col: number) => {
  let n = col;
  let s = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return `${s}${row}`;
};

export function cellAddress(ref: CellRef): string {
  return `${ref.sheet}!${A1(ref.row, ref.col)}`;
}

/**
 * Where a line's figures go: the first cell to the right of the name that is
 * empty or already holds a number. A units column ("$m", "%") is stepped over
 * rather than written into.
 */
function anchorFor(ws: ExcelJS.Worksheet, row: number, labelCol: number, lastCol: number): number | null {
  for (let c = labelCol + 1; c <= Math.min(lastCol, labelCol + 6); c++) {
    const v = ws.getRow(row).getCell(c).value;
    const t = textOf(v).trim();
    if (v === null || v === undefined || t === '') return c;
    if (isNum(v)) return c;
    if (/^[$£€¥₹%xX]|^[a-z]{1,3}m?$/.test(t) && t.length <= 4) continue; // a units column
    return c;
  }
  return null;
}

/** The firm's year header, where there is one, to know how wide their model is. */
function periodColumnsOf(ws: ExcelJS.Worksheet, anchorCol: number): number | null {
  let best: number | null = null;
  ws.eachRow({ includeEmpty: false }, (row) => {
    let run = 0;
    for (let c = anchorCol; c <= anchorCol + 20; c++) {
      const t = textOf(row.getCell(c).value).trim() || String(row.getCell(c).value ?? '');
      if (/^(FY)?\s?(19|20)\d{2}(E|A|F)?$/i.test(t.trim())) run++;
      else if (run > 0) break;
    }
    if (run >= 2 && (best === null || run > best)) best = run;
  });
  return best;
}

export function detectMapping(wb: ExcelJS.Workbook): Detection {
  const candidates = contractCandidates();
  const byKey = new Map<string, MappedLine>();
  const claims = new Map<string, string[]>();
  const sheets: string[] = [];

  wb.eachSheet((ws) => {
    sheets.push(ws.name);
    const lastCol = Math.max(ws.actualColumnCount || 0, ws.columnCount || 0, 8);
    ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
        const text = textOf(cell.value).trim();
        if (!text || text.length > 120) return;
        const match = matchName(text, candidates);
        if (!match) return;
        const col = anchorFor(ws, rowNumber, colNumber, lastCol);
        if (col === null) return;
        const line: MappedLine = {
          key: match.key,
          ours: String(
            Array.isArray((MODEL_SHEET_ROW_LABELS as any)[match.key])
              ? (MODEL_SHEET_ROW_LABELS as any)[match.key][0]
              : (MODEL_SHEET_ROW_LABELS as any)[match.key]
          ),
          theirs: text,
          how: match.how,
          confidence: match.confidence,
          sheet: ws.name,
          row: rowNumber,
          col,
        };
        const where = `${ws.name}!${A1(rowNumber, colNumber)}`;
        claims.set(match.key, [...(claims.get(match.key) ?? []), where]);
        const held = byKey.get(match.key);
        // THE BEST CLAIM WINS, and the losers are still reported as a conflict:
        // two cells wanting the same line is usually a heading repeated in a
        // summary, and occasionally a real ambiguity the firm must settle.
        if (!held || match.confidence > held.confidence) byKey.set(match.key, line);
      });
    });
  });

  const mapping = [...byKey.values()].sort((a, b) =>
    a.sheet === b.sheet ? a.row - b.row : a.sheet.localeCompare(b.sheet)
  );

  // A LINE WITH NOWHERE TO GO IS REPORTED, NEVER DROPPED.
  const unmapped: { key: string; label: string }[] = [];
  for (const c of candidates) {
    if (byKey.has(c.key)) continue;
    const raw = (MODEL_SHEET_ROW_LABELS as any)[c.key];
    unmapped.push({ key: c.key, label: String(Array.isArray(raw) ? raw[0] : raw) });
  }

  const conflicts = [...claims.entries()]
    .filter(([, at]) => at.length > 1)
    .map(([key, at]) => ({ key, at }));

  // HOW WIDE THEIR TABLE IS, SHEET BY SHEET. Taking one number for the whole
  // file was wrong on the first template tried: a balance sheet carrying two
  // years and a P&L carrying five are both normal, and a single figure either
  // writes past the edge of the narrow one or truncates the wide one.
  const periodColumnsBySheet: Record<string, number | null> = {};
  for (const line of mapping) {
    if (line.sheet in periodColumnsBySheet) continue;
    const ws = wb.getWorksheet(line.sheet);
    periodColumnsBySheet[line.sheet] = ws ? periodColumnsOf(ws, line.col) : null;
  }
  const widths = Object.values(periodColumnsBySheet).filter((v): v is number => typeof v === 'number');
  const periodColumns = widths.length ? Math.max(...widths) : null;

  return {
    mapping,
    unmapped,
    review: mapping.filter((m) => m.confidence < REVIEW_BELOW),
    conflicts,
    periodColumnsBySheet,
    periodColumns,
    sheets,
  };
}

// ---------------------------------------------------------------------------
// FILLING IT IN
// ---------------------------------------------------------------------------

export interface FillResult {
  bytes: ArrayBuffer;
  /** Lines of ours their template had no cell for. */
  unmapped: { key: string; label: string }[];
  /** Cells of theirs we were asked to fill and could not. */
  unfilled: { key: string; at: string; why: string }[];
  filled: number;
  periodsWritten: number;
}

/**
 * THEIR FORMATTING IS THEIRS AND OUR FIGURES ARE OURS.
 *
 * The template is loaded and written back out: every style, formula, merge,
 * print range and logo it arrived with is still there, because the file is
 * theirs and we only put numbers into the cells the mapping names. We do not
 * restyle a cell, we do not change a number format, and we do not touch a cell
 * no mapping points at.
 *
 * A cell we were asked to fill and cannot gets the words "not reported", never
 * a blank and never a zero: a blank in a filled model reads as nil, and a nil
 * we never had is the one thing this site exists not to print.
 */
export async function fillTemplate(
  templateBytes: ArrayBuffer,
  mapping: TemplateMapping,
  modelSheetValues: (key: string, period: number) => number | null | undefined,
  options: { periods: number }
): Promise<FillResult> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(templateBytes as any);

  const unfilled: FillResult['unfilled'] = [];
  let filled = 0;
  let widest = 0;
  /** A line is written as wide as ITS OWN sheet has room for, never wider. */
  const periodsFor = (sheet: string) => {
    const room = mapping.periodColumnsBySheet?.[sheet];
    return Math.max(0, Math.min(options.periods, typeof room === 'number' ? room : options.periods));
  };

  for (const line of mapping.lines) {
    const ws = wb.getWorksheet(line.sheet);
    if (!ws) {
      unfilled.push({
        key: line.key,
        at: cellAddress(line),
        why: `the sheet "${line.sheet}" is not in this file`,
      });
      continue;
    }
    const periods = periodsFor(line.sheet);
    if (periods > widest) widest = periods;
    for (let p = 0; p < periods; p++) {
      const cell = ws.getRow(line.row).getCell(line.col + p);
      const value = modelSheetValues(line.key, p);
      if (isNum(value)) {
        cell.value = value;
        filled++;
      } else {
        // NOT A BLANK AND NOT A ZERO.
        cell.value = CANNOT_FILL;
        unfilled.push({
          key: line.key,
          at: `${line.sheet}!${A1(line.row, line.col + p)}`,
          why: 'this model has no figure for that line in that period',
        });
      }
    }
  }

  const unmapped = unmappedOf(mapping);
  writeTheReport(wb, mapping, unmapped, unfilled, filled, widest);

  const out = await wb.xlsx.writeBuffer();
  return { bytes: out as ArrayBuffer, unmapped, unfilled, filled, periodsWritten: widest };
}

/** The contracted lines a mapping has no cell for. */
export function unmappedOf(mapping: TemplateMapping): { key: string; label: string }[] {
  const have = new Set(mapping.lines.map((l) => l.key));
  const out: { key: string; label: string }[] = [];
  for (const key of Object.keys(MODEL_SHEET_ROWS)) {
    if (have.has(key)) continue;
    const raw = (MODEL_SHEET_ROW_LABELS as any)[key];
    if (raw === undefined) continue;
    out.push({ key, label: String(Array.isArray(raw) ? raw[0] : raw) });
  }
  return out;
}

/**
 * A SHEET THAT SAYS WHAT WAS NOT CARRIED ACROSS.
 *
 * Reporting the gap in the browser and not in the file would mean the partner
 * reading the filled model a week later has no way of knowing that forty of our
 * lines had nowhere to go. The report travels with the file.
 */
function writeTheReport(
  wb: ExcelJS.Workbook,
  mapping: TemplateMapping,
  unmapped: { key: string; label: string }[],
  unfilled: FillResult['unfilled'],
  filled: number,
  periods: number
) {
  const NAME = 'Marginalia — what was mapped';
  const existing = wb.getWorksheet(NAME);
  if (existing) wb.removeWorksheet(existing.id);
  const ws = wb.addWorksheet(NAME, { properties: { tabColor: { argb: 'FF8B1E1E' } } });
  ws.getColumn(1).width = 2;
  ws.getColumn(2).width = 62;
  ws.getColumn(3).width = 34;
  ws.getColumn(4).width = 44;

  let r = 1;
  const put = (a: string, b?: string, c?: string, bold = false, colour?: string) => {
    const row = r++;
    ws.getCell(row, 2).value = a;
    if (b !== undefined) ws.getCell(row, 3).value = b;
    if (c !== undefined) ws.getCell(row, 4).value = c;
    for (let i = 2; i <= 4; i++) {
      ws.getCell(row, i).font = {
        name: 'Calibri',
        size: 11,
        bold,
        color: colour ? { argb: colour } : undefined,
      };
    }
    return row;
  };

  put(`Filled from the Marginalia template mapping "${mapping.name}"`, '', '', true);
  put(`${filled} figures written across ${periods} period${periods === 1 ? '' : 's'}.`);
  put('Your formatting is untouched. Only the cells named by the mapping were written.');
  r++;

  put('Lines this model carries that your template has no cell for', '', '', true, 'FF8B1E1E');
  put(
    unmapped.length
      ? `${unmapped.length} of our ${Object.keys(MODEL_SHEET_ROWS).length} lines were not carried across.`
      : 'None — every line this model carries has a place in your template.'
  );
  if (unmapped.length) {
    put('Our key', 'Our line', '');
    for (const u of unmapped) put(u.key, u.label, '');
  }
  r++;

  put('Cells your template asked for that this model could not fill', '', '', true, 'FF8B1E1E');
  put(
    unfilled.length
      ? `${unfilled.length} cell${unfilled.length === 1 ? '' : 's'} read "${CANNOT_FILL}" rather than being left blank.`
      : 'None — every mapped cell had a figure.'
  );
  if (unfilled.length) {
    put('Cell', 'Our key', 'Why');
    for (const u of unfilled.slice(0, 400)) put(u.at, u.key, u.why);
  }
  r++;

  put('Where the mapping points', '', '', true);
  put('Our key', 'Our line', 'Your cell');
  for (const line of mapping.lines) {
    put(line.key, line.ours, `${cellAddress(line)}  (${line.how})`);
  }
}

// ---------------------------------------------------------------------------
// OUR FIGURES, COMPUTED
// ---------------------------------------------------------------------------

/**
 * A TEMPLATE WANTS NUMBERS, AND OUR MODEL SHEET IS FORMULAS.
 *
 * Only the reported years are written as figures; everything else — operating
 * profit, the whole balance sheet, every forecast — is a formula Excel resolves
 * on open. Reading the cells straight gave "not reported" for Apple's net
 * income, which is the exact failure this feature exists to avoid: a cell that
 * looks like an absent figure and is really an unevaluated one.
 *
 * So the model is RECALCULATED before anything is read, by the same engine the
 * verification suite uses to prove the workbook reproduces the site. The
 * alternative was a second table mapping our 138 keys onto the engine's own
 * series, which would be a second source of truth for the thing section 22a
 * exists to have only one of.
 *
 * HyperFormula is imported dynamically so it is fetched only by someone who
 * actually fills a template, and costs every other reader nothing.
 */
export async function computeModelValues(
  ourWorkbook: ExcelJS.Workbook,
  sheetName = '3-StatementModel'
): Promise<(key: string, period: number) => number | null> {
  const { HyperFormula } = await import('hyperformula');
  const sheets: Record<string, any[][]> = {};
  ourWorkbook.eachSheet((ws) => {
    const grid: any[][] = [];
    ws.eachRow({ includeEmpty: false }, (row, rn) =>
      row.eachCell({ includeEmpty: true }, (cell, cn) => {
        const v: any = cell.value;
        (grid[rn - 1] ||= [])[cn - 1] =
          v && typeof v === 'object' && 'formula' in v ? `=${v.formula}` : v ?? null;
      })
    );
    for (let i = 0; i < grid.length; i++) grid[i] ||= [];
    sheets[ws.name] = grid;
  });
  const hf = HyperFormula.buildFromSheets(sheets, { licenseKey: 'gpl-v3' });
  const id = hf.getSheetId(sheetName);
  if (id === undefined) throw new Error(`no "${sheetName}" sheet to read figures from`);
  const FIRST_COLUMN = 5; // column E, as the chart of accounts lays it out
  return (key: string, period: number) => {
    const row = (MODEL_SHEET_ROWS as any)[key];
    if (row === undefined) return null;
    const v = hf.getCellValue({ sheet: id, row: row - 1, col: FIRST_COLUMN - 1 + period });
    return isNum(v) ? v : null;
  };
}

// ---------------------------------------------------------------------------
// A REVISED TEMPLATE
// ---------------------------------------------------------------------------

export interface Reconciliation {
  /** Lines whose cell still holds the same name in the new file. */
  kept: MappedLine[];
  /** Lines whose name has moved, with where it moved to. */
  moved: { line: MappedLine; to: CellRef; theirs: string }[];
  /** Lines whose name is not in the new file at all. */
  lost: MappedLine[];
  /** Lines the new file has that the old mapping did not. */
  gained: MappedLine[];
  /** True where the file is byte-identical to the one the mapping was made on. */
  unchanged: boolean;
}

/**
 * A FIRM'S TEMPLATE CHANGES, AND THE MAPPING SHOULD NOT HAVE TO BE REDONE.
 *
 * Most revisions move rows: a line is inserted, a section is reordered, a tab
 * is renamed. The mapping is stored against the NAME as well as the cell, so a
 * revision is reconciled rather than rebuilt — each mapped line is looked for
 * by its name first and its old address second.
 *
 * What is NOT done is silent re-pointing. A line that has moved is shown as
 * moved and the firm accepts it; a line whose name has gone is shown as lost
 * rather than quietly pointed at whatever now occupies its old cell, which
 * would put revenue on a row that used to be revenue and is now a spacer.
 */
export function reconcile(previous: TemplateMapping, next: Detection, sameBytes: boolean): Reconciliation {
  const byKey = new Map(next.mapping.map((m) => [m.key, m]));
  const kept: MappedLine[] = [];
  const moved: Reconciliation['moved'] = [];
  const lost: MappedLine[] = [];

  for (const line of previous.lines) {
    const found = byKey.get(line.key);
    if (!found) {
      lost.push(line);
      continue;
    }
    if (found.sheet === line.sheet && found.row === line.row && found.col === line.col) kept.push(line);
    else moved.push({ line, to: { sheet: found.sheet, row: found.row, col: found.col }, theirs: found.theirs });
  }

  const had = new Set(previous.lines.map((l) => l.key));
  const gained = next.mapping.filter((m) => !had.has(m.key));

  return { kept, moved, lost, gained, unchanged: sameBytes };
}

/** The reconciliation applied, which is a separate act from seeing it. */
export function applyReconciliation(previous: TemplateMapping, r: Reconciliation, next: Detection): TemplateMapping {
  const lines: MappedLine[] = [];
  const nextByKey = new Map(next.mapping.map((m) => [m.key, m]));
  for (const line of previous.lines) {
    const found = nextByKey.get(line.key);
    if (found) lines.push(found);
    // A LOST LINE IS DROPPED FROM THE MAPPING, not carried at a stale address.
    // It reappears in `unmapped`, which is reported in the filled file.
  }
  for (const g of r.gained) lines.push(g);
  return {
    ...previous,
    lines,
    periodColumnsBySheet: next.periodColumnsBySheet ?? previous.periodColumnsBySheet,
    periodColumns: next.periodColumns ?? previous.periodColumns,
    updatedAt: new Date().toISOString(),
  };
}

export default {
  detectMapping,
  fillTemplate,
  reconcile,
  applyReconciliation,
  matchName,
  normaliseLabel,
  unmappedOf,
  cellAddress,
  fingerprintOf,
  CANNOT_FILL,
  REVIEW_BELOW,
  SYNONYMS,
};
