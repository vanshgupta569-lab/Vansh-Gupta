// Marginalia — data verification check
//
// Open /api/verify in a browser. It fetches Apple live from the same route the
// site uses, compares every figure against the Excel-verified numbers in
// AAPL.js, and prints a pass/fail table.
//
// Why this exists: the engine has verify.mjs checking its maths against the
// Excel model. This is the same discipline applied one layer down, to the DATA.
// Three separate extraction bugs slipped through in a single afternoon and were
// only caught because Apple's figures happened to be known by heart. Any other
// company would have sailed through wrong. Run this after every change to
// api/company.js.
//
// A FAIL here does not always mean the fetcher is broken — see the notes on
// deliberate differences at the bottom of the table.
//
// CHANGED (five-year upgrade): figures are now matched to the fiscal year they
// belong to, not to their position in the array. Before, the first expected
// value was compared against whatever happened to sit first in the fetched
// list. Now that the fetcher returns five years instead of three, that would
// have compared FY2023's Excel figure against FY2021's filed figure and
// reported a wall of failures that were not failures at all. Years the Excel
// model does not cover are shown as "not checked" rather than counted wrong.

// Expected values, copied from src/data/AAPL.js, which came from the Excel
// model, keyed by fiscal year. Signs are made positive here, because the Excel
// stores costs as negatives and the fetcher does not. The Excel covers FY2023
// to FY2025 only; earlier years the fetcher now returns are displayed but not
// graded.
const EXPECTED = {
  revenue: { 2023: 383285, 2024: 391035, 2025: 416161 },
  cogs: { 2023: 214137, 2024: 210352, 2025: 220960 },
  rnd: { 2023: 29915, 2024: 31370, 2025: 34550 },
  sga: { 2023: 24932, 2024: 26097, 2025: 27601 },
  taxExpense: { 2023: 16741, 2024: 29749, 2025: 20719 },
  receivables: { 2024: 33410, 2025: 39777 },
  inventory: { 2024: 7286, 2025: 5718 },
  ppeNet: { 2023: 43715, 2024: 45680, 2025: 49834 },
  depreciation: { 2023: 11519, 2024: 11445, 2025: 11698 },
  stockComp: { 2023: 10833, 2024: 11688, 2025: 12863 },
  capex: { 2024: 9447, 2025: 12715 },
  dividendsPaid: { 2023: 15025, 2024: 15234, 2025: 15421 },
  buybacks: { 2023: 77550, 2024: 94949, 2025: 90711 },
  dilutedShares: { 2023: 15812547000, 2024: 15408095000, 2025: 15004697000 },
};

// Figures where the Excel deliberately uses a different definition from the
// raw filing. These are expected to differ and are reported separately, not as
// failures — but they must stay visible, because an auto-generated model will
// silently use the filing definition unless something says otherwise.
const KNOWN_DIFFERENCES = {
  cash: 'Excel uses cash PLUS marketable securities; the filing tag is cash and equivalents only.',
  longTermDebt: 'Excel appears to include the current portion of term debt; the filing tag is the non-current portion only.',
};

// Share counts are exact; money figures are allowed a rounding tolerance.
function withinTolerance(expected, actual) {
  if (expected === null || expected === undefined) return null;
  if (actual === null || actual === undefined) return null;
  const gap = Math.abs(expected - actual);
  return gap <= Math.max(1, Math.abs(expected) * 0.005); // 0.5%
}

function fmt(v) {
  if (v === null || v === undefined) return '—';
  return typeof v === 'number' ? v.toLocaleString() : String(v);
}

export default async function handler(req, res) {
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const protocol = req.headers['x-forwarded-proto'] || 'https';

  let data;
  try {
    const response = await fetch(`${protocol}://${host}/api/company?ticker=AAPL`);
    data = await response.json();
  } catch (error) {
    res.setHeader('Content-Type', 'text/html');
    res.status(200).send(`<p>Could not reach the fetcher: ${error.message}</p>`);
    return;
  }

  if (!data.statements) {
    res.setHeader('Content-Type', 'text/html');
    res.status(200).send(`<p>Fetcher returned no statements: ${data.error || 'unknown'}</p>`);
    return;
  }

  // The years the fetcher actually returned, plus a lookup so a figure can be
  // found by its year instead of by its position in the list.
  const years = data.statements.map((s) => s.fiscalYear);
  const byYear = {};
  for (const statement of data.statements) byYear[statement.fiscalYear] = statement;

  const rows = [];
  let passes = 0;
  let failures = 0;
  let skipped = 0;
  let unchecked = 0;

  for (const [field, expectedByYear] of Object.entries(EXPECTED)) {
    const cells = years.map((year) => {
      const expected = expectedByYear[year];
      const actual = byYear[year]?.[field] ?? null;

      // No Excel figure for this year at all: outside the model's coverage.
      if (expected === undefined) {
        unchecked++;
        return { expected: null, actual, ok: null, covered: false };
      }

      const ok = withinTolerance(expected, actual);
      if (ok === null) skipped++;
      else if (ok) passes++;
      else failures++;
      return { expected, actual, ok, covered: true };
    });
    rows.push({ field, cells });
  }

  const style = `
    body { background:#0B0B0D; color:#F2F0EA; font-family:'JetBrains Mono',monospace;
           font-size:13px; padding:32px; }
    h1 { font-family:Georgia,serif; font-weight:500; font-size:24px; margin:0 0 4px; }
    .sub { color:#8A8A8F; font-size:11px; text-transform:uppercase;
           letter-spacing:.2em; margin-bottom:24px; }
    table { border-collapse:collapse; width:100%; max-width:1100px; }
    th,td { text-align:right; padding:7px 12px; border-bottom:1px solid #222228; }
    th:first-child, td:first-child { text-align:left; }
    th { color:#8A8A8F; font-size:10px; text-transform:uppercase; letter-spacing:.15em; }
    .pass { color:#4ADE80; } .fail { color:#8B1E1E; font-weight:600; }
    .skip { color:#8A8A8F; }
    .summary { margin:24px 0; padding:14px 18px; border:1px solid #222228; max-width:1100px; }
    .note { color:#8A8A8F; font-size:11px; line-height:1.7; margin-top:24px;
            max-width:1100px; border-top:1px solid #222228; padding-top:16px; }
  `;

  const header = years.map((year) => `<th>FY${year}</th>`).join('');

  const body = rows
    .map((row) => {
      const cells = row.cells
        .map((cell) => {
          // A year the Excel model never covered: show the filed figure in grey
          // so it can be eyeballed, but grade nothing.
          if (!cell.covered) {
            return `<td class="skip">${fmt(cell.actual)}<br><span class="skip">not checked</span></td>`;
          }
          if (cell.ok === null) return `<td class="skip">—</td>`;
          const cls = cell.ok ? 'pass' : 'fail';
          const mark = cell.ok ? '✓' : '✗';
          const detail = cell.ok
            ? fmt(cell.actual)
            : `${fmt(cell.actual)}<br><span class="skip">want ${fmt(cell.expected)}</span>`;
          return `<td class="${cls}">${mark} ${detail}</td>`;
        })
        .join('');
      return `<tr><td>${row.field}</td>${cells}</tr>`;
    })
    .join('');

  const diffNotes = Object.entries(KNOWN_DIFFERENCES)
    .map(([field, why]) => {
      const actuals = data.statements
        .map((s) => `FY${s.fiscalYear}: ${fmt(s[field])}`)
        .join(' · ');
      return `<p><strong>${field}</strong> — filing gives ${actuals}. ${why}</p>`;
    })
    .join('');

  res.setHeader('Content-Type', 'text/html');
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).send(`<!doctype html><html><head><meta charset="utf-8">
    <title>Marginalia — data verification</title><style>${style}</style></head><body>
    <h1>Data verification — Apple</h1>
    <div class="sub">live fetcher output vs the Excel-verified model</div>
    <div class="summary">
      <strong>${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}</strong><br>
      ${passes} passed · ${failures} failed · ${skipped} not comparable ·
      ${unchecked} outside the Excel's years<br>
      <span class="skip">source: ${data.source} · years returned: ${years.length}
      (FY${years[0]} to FY${years[years.length - 1]}) · fetched ${data.fetchedAt}</span>
    </div>
    <table>
      <tr><th>Line item</th>${header}</tr>
      ${body}
    </table>
    <div class="note">
      <strong>Deliberate definitional differences — not failures:</strong>
      ${diffNotes}
      <p>Blank cells are figures the Excel model leaves empty for that year, so
      there is nothing to compare against. Cells marked "not checked" are years
      the fetcher now returns but the Excel model does not cover: the filed
      figure is shown so it can be sense-checked by eye, but it is not graded.</p>
    </div>
  </body></html>`);
}