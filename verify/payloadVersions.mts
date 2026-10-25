// FILE: verify/payloadVersions.mts
//
// THE PAYLOAD CAPTURE STORE: EVERY VERSION, KEPT, NEVER OVERWRITTEN.
//
// Stage 0 of `docs/ARCHIVE_PLAN.md`. Until now a refetch replaced the payload
// file: `npm run verify:payloads -- --force` wrote over the bytes, and the
// version it replaced was gone. That is a loss happening continuously and with
// nobody's permission needed to stop it — six payloads were replaced on
// 2026-10-25 alone, and with them the prices every earlier measurement in this
// repository was struck against.
//
// So a fetch now writes TWO things:
//
//   verify/payloads/<TICKER>.json                    the pointer: the latest
//                                                     capture, which is what
//                                                     everything reads
//   verify/payloads/versions/<TICKER>/<when>__<sha>.json   the capture itself,
//                                                     written once and never
//                                                     touched again
//
// WHY THE NAME CARRIES THE HASH. A file named after the hash of its own
// contents cannot be quietly rewritten: change one byte and the name stops
// describing the file. That is what `audit()` below checks, and it is the whole
// reason the hash is in the name rather than only in the index.
//
// THE INDEX IS A LOG, NOT A TABLE. `versions/index.jsonl` gets one line per
// capture, appended, never edited. It carries what `docs/ARCHIVE_PLAN.md` §1
// says every capture must carry: the hash, the capture time, the source's own
// date, and enough identity to find the thing again.
//
// WHAT DEDUPLICATION DOES NOT BUY HERE, said plainly because the design looks
// like it should. The payload contains `fetchedAt` and a live `quote.price`, so
// two fetches of the same company are never byte-identical: every refetch is a
// new version by construction. Content addressing is here to make overwriting
// detectable, not to save space.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { PAYLOADS } from './payloadSet.mts';

export const VERSIONS = path.join(PAYLOADS, 'versions');
export const INDEX = path.join(VERSIONS, 'index.jsonl');

export interface CaptureRow {
  /** The company, as the payload set names it. */
  ticker: string;
  /** When WE took the copy. The archive's own clock. */
  capturedAt: string;
  /** Of the bytes exactly as stored. */
  sha256: string;
  bytes: number;
  /** The source's own date for the document, which is a different thing. */
  fetchedAt: string | null;
  /** The shape it is in, so a capture can be read by the code that fits it. */
  fetcherVersion: number | null;
  /** Where the figures came from, as the payload records it. */
  source: string | null;
  /** The price the capture was struck at: the one input that moves every hour. */
  price: number | null;
  /** A capture of a failure is still a capture, and is kept as one. */
  error: string | null;
  /** Relative to `versions/`, with forward slashes. */
  file: string;
}

const sha256 = (buf: Buffer | string) => crypto.createHash('sha256').update(buf).digest('hex');

/** `2026-10-25T18:40:07.123Z` -> `2026-10-25T18-40-07Z`: a legal filename on every platform. */
const stamp = (iso: string) => iso.replace(/\.\d+Z$/, 'Z').replace(/:/g, '-');

const tickerDir = (ticker: string) => path.join(VERSIONS, ticker);

/** Every capture of one company, oldest first. Read from the files, not the index. */
export function listVersions(ticker: string): { capturedAt: string; sha256: string; file: string }[] {
  const dir = tickerDir(ticker);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      const [when, sha] = f.replace(/\.json$/, '').split('__');
      return { capturedAt: when, sha256: sha, file: path.join(dir, f) };
    })
    .sort((a, b) => (a.capturedAt < b.capturedAt ? -1 : a.capturedAt > b.capturedAt ? 1 : 0));
}

/** The newest capture of one company, or null if it has never been captured. */
export function latestVersion(ticker: string) {
  const all = listVersions(ticker);
  return all.length ? all[all.length - 1] : null;
}

export function readIndex(): CaptureRow[] {
  if (!fs.existsSync(INDEX)) return [];
  return fs
    .readFileSync(INDEX, 'utf8')
    .split('\n')
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l) as CaptureRow);
}

/**
 * Keep one capture. Returns what was done, and never overwrites anything.
 *
 * `bytes` is written exactly as given — this is the "stored unchanged" promise,
 * so the caller hands over the same string it is about to write to the pointer
 * rather than a re-serialised object.
 */
export function capture(
  ticker: string,
  bytes: string,
  capturedAt = new Date().toISOString()
): { written: boolean; sha256: string; file: string; reason?: string } {
  const sha = sha256(bytes);
  const dir = tickerDir(ticker);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${stamp(capturedAt)}__${sha.slice(0, 12)}.json`);

  // ALREADY HELD. Two fetches inside the same second of a payload that did not
  // change are the same capture, not two; anything else differs in `fetchedAt`
  // and so differs in its hash.
  if (fs.existsSync(file)) return { written: false, sha256: sha, file, reason: 'already captured' };

  // `wx` FAILS RATHER THAN REPLACES. The audit would catch an overwrite after
  // the fact; this stops it happening at all.
  fs.writeFileSync(file, bytes, { encoding: 'utf8', flag: 'wx' });
  // And then the file is made read-only, so an accidental write from anywhere
  // else is an error at the operating system rather than a silent loss.
  try {
    fs.chmodSync(file, 0o444);
  } catch {
    /* a filesystem that will not do this is not a reason to fail the capture */
  }

  let body: any = null;
  try {
    body = JSON.parse(bytes);
  } catch {
    /* a capture that will not parse is still a capture */
  }
  const row: CaptureRow = {
    ticker,
    capturedAt,
    sha256: sha,
    bytes: Buffer.byteLength(bytes),
    fetchedAt: typeof body?.fetchedAt === 'string' ? body.fetchedAt : null,
    fetcherVersion: typeof body?.fetcherVersion === 'number' ? body.fetcherVersion : null,
    source: typeof body?.source === 'string' ? body.source : null,
    price: typeof body?.quote?.price === 'number' ? body.quote.price : null,
    error: body?.error ? String(body.error).slice(0, 200) : null,
    file: path.relative(VERSIONS, file).split(path.sep).join('/'),
  };
  fs.mkdirSync(VERSIONS, { recursive: true });
  fs.appendFileSync(INDEX, JSON.stringify(row) + '\n', 'utf8');
  return { written: true, sha256: sha, file };
}

/**
 * ADOPT WHAT IS ALREADY ON DISK, once.
 *
 * The 176 payloads that existed before this store did have no capture history,
 * and inventing one would be a lie. What they do carry is `fetchedAt`, which is
 * the moment the fetcher took them — the capture time, recorded by the only
 * party who knew it. Where that is missing the file's own mtime is used and the
 * row says so by having a null `fetchedAt`.
 */
export function adopt(): { adopted: number; already: number } {
  let adopted = 0;
  let already = 0;
  for (const file of fs.readdirSync(PAYLOADS).filter((f) => f.endsWith('.json'))) {
    const ticker = file.replace(/\.json$/, '');
    if (listVersions(ticker).length) {
      already++;
      continue;
    }
    const full = path.join(PAYLOADS, file);
    const bytes = fs.readFileSync(full, 'utf8');
    let when: string;
    try {
      const body = JSON.parse(bytes);
      when = typeof body?.fetchedAt === 'string' ? body.fetchedAt : fs.statSync(full).mtime.toISOString();
    } catch {
      when = fs.statSync(full).mtime.toISOString();
    }
    if (capture(ticker, bytes, when).written) adopted++;
  }
  return { adopted, already };
}

export interface AuditReport {
  tickers: number;
  versions: number;
  bytes: number;
  indexRows: number;
  problems: string[];
}

/**
 * THE CHECK: NOTHING THAT WAS CAPTURED HAS BEEN CHANGED OR LOST.
 *
 * Five things, and the first two are the ones this store exists for:
 *
 *   1. EVERY CAPTURE STILL HASHES TO ITS OWN NAME. A file named after the hash
 *      of its contents is a file that cannot be edited quietly.
 *   2. THE FILES AND THE INDEX AGREE, BOTH WAYS. A capture missing from the log
 *      and a logged capture missing from disk are both failures, so neither a
 *      deleted file nor a deleted line can hide.
 *   3. EVERY PAYLOAD IN THE SET HAS AT LEAST ONE CAPTURE.
 *   4. THE POINTER IS THE NEWEST CAPTURE, byte for byte — which is what makes
 *      "the site always reads the latest" true rather than intended.
 *   5. NO TWO CAPTURES CLAIM THE SAME MOMENT AND THE SAME CONTENT.
 */
export function audit(): AuditReport {
  const problems: string[] = [];
  const rows = readIndex();
  const byFile = new Map<string, CaptureRow>();
  for (const row of rows) {
    if (byFile.has(row.file)) problems.push(`the log records ${row.file} twice`);
    byFile.set(row.file, row);
  }

  let versions = 0;
  let bytes = 0;
  const seen = new Set<string>();
  const pointers = fs.existsSync(PAYLOADS)
    ? fs.readdirSync(PAYLOADS).filter((f) => f.endsWith('.json'))
    : [];

  if (fs.existsSync(VERSIONS)) {
    for (const ticker of fs.readdirSync(VERSIONS)) {
      const dir = path.join(VERSIONS, ticker);
      if (!fs.statSync(dir).isDirectory()) continue;
      for (const v of listVersions(ticker)) {
        versions++;
        const rel = path.relative(VERSIONS, v.file).split(path.sep).join('/');
        seen.add(rel);
        const buf = fs.readFileSync(v.file);
        bytes += buf.length;
        const actual = sha256(buf);
        // ---- 1. the capture is the capture ----
        if (!actual.startsWith(v.sha256)) {
          problems.push(
            `${rel} has been changed since it was captured: it is named for ${v.sha256} and now hashes to ` +
              `${actual.slice(0, 12)}`
          );
        }
        // ---- 2a. and the log knows about it ----
        const row = byFile.get(rel);
        if (!row) problems.push(`${rel} is on disk but not in the capture log`);
        else if (row.sha256 !== actual) {
          problems.push(
            `${rel} does not match its log row: the log says ${row.sha256.slice(0, 12)} and the file hashes ` +
              `to ${actual.slice(0, 12)}`
          );
        } else if (row.bytes !== buf.length) {
          problems.push(`${rel} is ${buf.length} bytes and the log says ${row.bytes}`);
        }
      }
    }
  }

  // ---- 2b. and nothing the log knows about has gone ----
  for (const row of rows) {
    if (!seen.has(row.file)) problems.push(`${row.file} is in the capture log and not on disk`);
  }

  // ---- 3, 4. every payload is captured, and the pointer is the newest one ----
  for (const file of pointers) {
    const ticker = file.replace(/\.json$/, '');
    const all = listVersions(ticker);
    if (!all.length) {
      problems.push(`${ticker} has a payload and no capture of it: run  npx tsx verify/payloadVersions.mts --adopt`);
      continue;
    }
    const newest = all[all.length - 1];
    const pointer = fs.readFileSync(path.join(PAYLOADS, file));
    const held = fs.readFileSync(newest.file);
    if (!pointer.equals(held)) {
      problems.push(
        `${ticker}.json is not its newest capture (${path.basename(newest.file)}), so the set is reading ` +
          'something that was never kept'
      );
    }
  }

  // ---- 5. two captures of the same thing at the same instant ----
  const stamps = new Set<string>();
  for (const row of rows) {
    const key = `${row.ticker}@${row.capturedAt}#${row.sha256}`;
    if (stamps.has(key)) problems.push(`two log rows claim the same capture: ${key}`);
    stamps.add(key);
  }

  return { tickers: pointers.length, versions, bytes, indexRows: rows.length, problems };
}

/** What the store holds, and what a year of it would weigh. */
export function sizeLine(report = audit()): string {
  const mb = report.bytes / 1048576;
  const mean = report.versions ? report.bytes / report.versions : 0;
  // A full refetch writes one new capture per company, always: `fetchedAt` and
  // the live price are inside the payload, so no two fetches are identical.
  const perRefetch = (mean * report.tickers) / 1048576;
  return (
    `${report.versions} captures of ${report.tickers} companies, ${mb.toFixed(2)} MB ` +
    `(mean ${(mean / 1024).toFixed(0)} KB). A full refetch adds ${perRefetch.toFixed(1)} MB, ` +
    `so a year costs ${(perRefetch * 12).toFixed(0)} MB at one a month and ${(perRefetch * 52).toFixed(0)} MB at one a week.`
  );
}

// ---------------------------------------------------------------- the command
if (import.meta.url === `file:///${process.argv[1].split(path.sep).join('/')}`) {
  const args = process.argv.slice(2);
  if (args.includes('--adopt')) {
    const { adopted, already } = adopt();
    console.log(`adopted ${adopted} payloads as their first capture; ${already} already had one`);
  }
  const report = audit();
  console.log(sizeLine(report));
  if (report.problems.length) {
    console.log(`\nPROBLEM: ${report.problems.length} faults in the capture store:`);
    report.problems.slice(0, 10).forEach((p) => console.log(`  ${p}`));
    process.exit(1);
  }
  console.log('every capture still hashes to its own name, and every pointer is its newest capture');
}
