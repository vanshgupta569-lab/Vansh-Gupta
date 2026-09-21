// FILE: verify/sweep.mts
//
// Runs the engine over every fetched payload and writes a snapshot of what the
// site would show. Two snapshots, taken either side of a change, are what
// `compare.mts` measures.
//
//   npm run verify:sweep -- before     before touching anything
//   ...make the change...
//   npm run verify:sweep -- after
//   npm run verify:compare -- before after
//
// The point of snapshotting rather than diffing against a checkout of HEAD is
// that the payloads, the drivers and the machine are then identical on both
// sides: the only thing that moved is the code.
//
// Everything a recent job needed to measure is recorded per company, so a
// question like "what happened to the cost of debt" does not need a new
// script: value per share on both terminal methods, the refusal code where
// there is no value, the cost of capital and its parts, net debt and its
// pieces, the borrowings and the securities behind them, EBITDA, the terminal
// spread, and the provenance sentences the screen shows.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..').split(path.sep).join('/');
const PAYLOADS = path.join(HERE, 'payloads');
const SNAPSHOTS = path.join(HERE, 'snapshots');
fs.mkdirSync(SNAPSHOTS, { recursive: true });

const tag = process.argv[2];
if (!tag) {
  console.error('Usage: npm run verify:sweep -- <tag>        (e.g. before, after)');
  process.exit(2);
}
if (!fs.existsSync(PAYLOADS) || !fs.readdirSync(PAYLOADS).some((f) => f.endsWith('.json'))) {
  console.error('No payloads. Fetch them first:  npm run verify:payloads');
  process.exit(2);
}

const { buildCompanyFrom } = await import(`file:///${REPO}/src/data/autoCompany.ts`);
const { calculateDCFFor, defaultDriversFor, buildFullModel } = await import(
  `file:///${REPO}/src/data/companies.ts`
);
const { terminalSpread } = await import(`file:///${REPO}/src/data/terminalSpread.ts`);

const isNum = (v: any) => typeof v === 'number' && isFinite(v);
const out: Record<string, any> = {};

for (const file of fs.readdirSync(PAYLOADS).filter((f) => f.endsWith('.json')).sort()) {
  const t = file.replace('.json', '');
  const payload = JSON.parse(fs.readFileSync(path.join(PAYLOADS, file), 'utf8'));
  if (payload.error || !payload.statements) {
    out[t] = { fetchError: String(payload.error ?? 'no statements').slice(0, 80) };
    continue;
  }

  let rec: any;
  try {
    rec = buildCompanyFrom(payload);
  } catch (e: any) {
    out[t] = { buildError: e.message.slice(0, 80) };
    continue;
  }

  const row: any = { name: payload.name || t, price: rec.price ?? null, source: payload.source ?? null };
  const src = rec.modelData;

  // Banks and other financials are valued on residual income, not a DCF.
  const ri = rec.residualIncome;
  if (ri) {
    row.residualIncome = ri.applicable ? ri.valuePerShare : 'refused';
    if (!ri.applicable) row.residualIncomeRefusal = String(ri.message).slice(0, 120);
    else Object.assign(row, { riRoe: ri.roe, riPayout: ri.payout, riBook: ri.openingBook });
  }

  if (src) {
    row.provenance = {
      netDebt: src.provenance?.netDebt ?? null,
      interest: src.provenance?.interest ?? null,
      equityBridge: src.provenance?.equityBridge ?? null,
    };
    const drivers = { ...rec.defaultDrivers, ...defaultDriversFor(src) };
    const site = calculateDCFFor(src, drivers, rec.price || null);
    if (site.applicable === false) {
      row.refusal = site.refusalCode ?? 'other';
      row.refusalMessage = String(site.message ?? '').slice(0, 140);
    } else {
      const { model: M, dcf: D } = buildFullModel(src, drivers);
      const nH = src.meta.historicalYears.length;
      const w = D.waccDetail || {};
      Object.assign(row, {
        perpetuity: D.perpetuity.valuePerShare,
        exitMultiple: D.exitMultipleValuation.valuePerShare,
        spread: terminalSpread(D.perpetuity.valuePerShare, D.exitMultipleValuation.valuePerShare)?.spread ?? null,
        wacc: D.wacc,
        costOfEquity: w.costOfEquity,
        costOfDebt: w.costOfDebt,
        beta: w.beta,
        weightDebt: w.weightDebt,
        netDebt: D.netDebt,
        debt: M.balanceSheet.longTermDebt[nH - 1],
        cash: M.balanceSheet.cashAndSecurities[nH - 1],
        otherCurrentAssets: M.balanceSheet.otherCurrentAssets[nH - 1],
        ebitda: M.ebitda[nH - 1],
        minorityInterest: D.minorityInterest,
        preferredStock: D.preferredStock,
        shares: D.dilutedShares ?? D.perpetuity?.dilutedShares ?? null,
        enterpriseValue: D.enterpriseValuePerpetuity,
        normalisedTerminal: D.normalisedFCF,
        // Worst reported-year balance check: must be zero, whatever else moved.
        worstBalanceCheck: Math.max(
          0,
          ...M.balanceSheet.balanceCheck.slice(0, nH).filter(isNum).map((v: number) => Math.abs(v))
        ),
      });
    }
  }
  out[t] = row;
}

fs.writeFileSync(path.join(SNAPSHOTS, `${tag}.json`), JSON.stringify(out, null, 1));

const rows = Object.values(out) as any[];
const valued = rows.filter((r) => isNum(r.perpetuity));
const banks = rows.filter((r) => isNum(r.residualIncome));
const worstCheck = Math.max(0, ...rows.map((r) => r.worstBalanceCheck ?? 0));
console.log(
  `${tag}: ${rows.length} payloads, ${rows.filter((r) => !r.fetchError && !r.buildError).length} modelled, ` +
    `${valued.length} with a DCF value, ${banks.length} with a residual income value, ` +
    `${rows.filter((r) => r.refusal).length} refused`
);
console.log(`worst reported-year balance check: ${worstCheck.toFixed(4)}${worstCheck > 0 ? '  <-- NOT ZERO' : ''}`);
console.log(`written to verify/snapshots/${tag}.json`);
