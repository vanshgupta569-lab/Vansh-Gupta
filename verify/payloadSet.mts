// FILE: verify/payloadSet.mts
//
// READING THE PAYLOAD SET, AND REFUSING TO MEASURE A STALE ONE.
//
// Every measurement in this directory is taken over the payloads on disk. They
// are fetched once and reused for weeks, which is the point — the same figures
// on both sides of a change mean the only thing that moved is the code.
//
// The failure that makes them dangerous is the quiet one. When `api/company.js`
// starts fetching a field, the payloads on disk predate it, and the engine
// reads the missing field as a reported absence: a company refused for a
// currency it does report, a cash flow total shown as not filed, a risk-free
// rate that is not there. A sweep over that set does not fail. It produces
// numbers, and the numbers look fine.
//
// So every reader goes through here, every payload carries the version of the
// fetcher that built it, and a set that does not match the fetcher stops the
// run with the command that fixes it. Refusing to measure is the whole point:
// a refetch takes a quarter of an hour and hits live sources, so it is the
// operator's decision to make, not something a measurement run should do behind
// their back — and two runs either side of an implicit refetch would not be
// comparable anyway.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..').split(path.sep).join('/');
export const PAYLOADS = path.join(HERE, 'payloads');

const { PAYLOAD_VERSION } = await import(`file:///${REPO}/src/data/payloadVersion.ts`);

// THE TWO CONSTANTS MUST AGREE, and nothing else would notice if they stopped.
//
// `api/company.js` carries its own FETCHER_VERSION because each file in that
// directory is packaged on its own by the host, and a shared import that fails
// to bundle takes the route down. That reasoning is sound and the cost is two
// copies of one number, which is exactly the kind of pair that drifts: bump one,
// forget the other, and every answer is stamped with a shape the reader does not
// expect — or worse, the reader asks for a shape the fetcher has never heard of
// and the mismatch is silent because both sides think they are right.
//
// So the number is read out of the fetcher's source, here, on every verify run.
// Reading the source rather than importing it is deliberate: importing
// `api/company.js` would run a Vercel handler module for a constant.
export function checkVersionsAgree(): void {
  const file = path.join(REPO, 'api', 'company.js');
  const source = fs.readFileSync(file, 'utf8');
  const match = source.match(/const FETCHER_VERSION\s*=\s*(\d+)\s*;/);
  if (!match) {
    console.log('  PROBLEM: api/company.js has no FETCHER_VERSION to check against PAYLOAD_VERSION');
    process.exit(2);
  }
  const fetcher = Number(match[1]);
  if (fetcher !== PAYLOAD_VERSION) {
    console.log(
      `\n  STOPPING: the two payload version constants disagree.\n` +
        `      api/company.js            FETCHER_VERSION = ${fetcher}\n` +
        `      src/data/payloadVersion.ts PAYLOAD_VERSION = ${PAYLOAD_VERSION}\n\n` +
        '  They are duplicated on purpose — each file in api/ is packaged on its own — but they have to\n' +
        '  agree, or the browser asks for one shape and the fetcher stamps another. Set them both to the\n' +
        '  new number, and say in payloadVersion.ts what it added.\n'
    );
    process.exit(2);
  }
}

export interface StaleReport {
  total: number;
  current: number;
  stale: { ticker: string; version: number | null }[];
  errors: number;
}

/** What shape each payload on disk is in. */
export function surveyPayloads(): StaleReport {
  const files = fs.existsSync(PAYLOADS)
    ? fs.readdirSync(PAYLOADS).filter((f) => f.endsWith('.json'))
    : [];
  const report: StaleReport = { total: 0, current: 0, stale: [], errors: 0 };
  for (const file of files) {
    let body: any;
    try {
      body = JSON.parse(fs.readFileSync(path.join(PAYLOADS, file), 'utf8'));
    } catch {
      report.errors++;
      continue;
    }
    // A payload that records a fetch failure is not stale, it is a failure, and
    // the sweep already reports those.
    if (body?.error || body?.fetchError) {
      report.errors++;
      continue;
    }
    report.total++;
    const version = typeof body?.fetcherVersion === 'number' ? body.fetcherVersion : null;
    if (version === PAYLOAD_VERSION) report.current++;
    else report.stale.push({ ticker: file.replace(/\.json$/, ''), version });
  }
  return report;
}

/** One line for a run's header, so every measurement says what it was taken over. */
export function payloadSetLine(report = surveyPayloads()): string {
  return (
    `payload set: ${report.total} payloads, ${report.current} built by the current fetcher (v${PAYLOAD_VERSION})` +
    (report.stale.length ? `, ${report.stale.length} OLDER` : '') +
    (report.errors ? `, ${report.errors} carrying a fetch error` : '')
  );
}

/**
 * Stop a measurement run over a set the current code cannot read.
 *
 * `allowStale` is for the tools whose job is to report on the set itself.
 */
export function requireCurrentPayloads(allowStale = false): StaleReport {
  checkVersionsAgree();
  const report = surveyPayloads();
  console.log(payloadSetLine(report));
  if (!report.stale.length || allowStale) return report;

  const named = report.stale
    .slice(0, 8)
    .map((s) => `${s.ticker} (v${s.version ?? 'unstamped'})`)
    .join(', ');
  console.log(
    `\n  STOPPING: ${report.stale.length} payload${report.stale.length === 1 ? '' : 's'} on disk ` +
      `${report.stale.length === 1 ? 'was' : 'were'} built by an older fetcher than the code reading ` +
      `them: ${named}${report.stale.length > 8 ? `, and ${report.stale.length - 8} more` : ''}.\n` +
      '  A field this code expects would be read as a figure the company does not report, and the run would\n' +
      '  produce numbers that look valid. Refetch the set first:\n\n' +
      '      npm run verify:payloads -- --force\n'
  );
  process.exit(2);
}

/** Read one payload, refusing the same way. */
export function readPayload(file: string): any {
  const body = JSON.parse(fs.readFileSync(path.join(PAYLOADS, file), 'utf8'));
  const version = typeof body?.fetcherVersion === 'number' ? body.fetcherVersion : null;
  if (!body?.error && !body?.fetchError && version !== PAYLOAD_VERSION) {
    throw new Error(
      `${file} was built by fetcher v${version ?? 'unstamped'}, and this code reads v${PAYLOAD_VERSION}. ` +
        'Refetch it:  npm run verify:payloads -- --force'
    );
  }
  return body;
}

export default {
  PAYLOADS,
  surveyPayloads,
  payloadSetLine,
  requireCurrentPayloads,
  readPayload,
  checkVersionsAgree,
};
