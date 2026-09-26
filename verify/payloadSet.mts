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

export default { PAYLOADS, surveyPayloads, payloadSetLine, requireCurrentPayloads, readPayload };
