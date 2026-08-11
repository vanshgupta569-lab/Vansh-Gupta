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

// Expected values, copied from src/data/AAPL.js, which came from the Excel
// model. Arrays run [FY2023, FY2024, FY2025]. Signs are made positive here,
// because the Excel stores costs as negatives and the fetcher does not.
const EXPECTED = {
  revenue: [383285, 391035, 416161],
  cogs: [214137, 210352, 220960],
  rnd: [29915, 31370, 34550],
  sga: [24932, 26097, 27601],
  taxExpense: [16741, 29749, 20719],
  receivables: [null, 33410, 39777],
  inventory: [null, 7286, 5718],
  ppeNet: [43715, 45680, 49834],
  depreciation: [11519, 11445, 11698],
  stockComp: [10833, 11688, 12863],
  capex: [null, 9447, 12715],
  dividendsPaid: [15025, 15234, 15421],
  buybacks: [77550, 94949, 90711],
  dilutedShares: [15812547000, 15408095000, 15004697000],
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
  if (expected === null || actual === null) return null; // nothing to compare
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

  const rows = [];
  let passes = 0;
  let failures = 0;
  let skipped = 0;

  for (const [field, expectedYears] of Object.entries(EXPECTED)) {
    const cells = expectedYears.map((expected, index) => {
      const actual = data.statements[index]?.[field] ?? null;
      const ok = withinTolerance(expected, actual);
      if (ok === null) skipped++;
      else if (ok) passes++;
      else failures++;
      return { expected, actual, ok };
    });
    rows.push({ field, cells });
  }

  const style = `
    body { background:#0B0B0D; color:#F2F0EA; font-family:'JetBrains Mono',monospace;
           font-size:13px; padding:32px; }
    h1 { font-family:Georgia,serif; font-weight:500; font-size:24px; margin:0 0 4px; }
    .sub { color:#8A8A8F; font-size:11px; text-transform:uppercase;
           letter-spacing:.2em; margin-bottom:24px; }
    table { border-collapse:collapse; width:100%; max-width:900px; }
    th,td { text-align:right; padding:7px 12px; border-bottom:1px solid #222228; }
    th:first-child, td:first-child { text-align:left; }
    th { color:#8A8A8F; font-size:10px; text-transform:uppercase; letter-spacing:.15em; }
    .pass { color:#4ADE80; } .fail { color:#8B1E1E; font-weight:600; }
    .skip { color:#8A8A8F; }
    .summary { margin:24px 0; padding:14px 18px; border:1px solid #222228; max-width:900px; }
    .note { color:#8A8A8F; font-size:11px; line-height:1.7; margin-top:24px;
            max-width:900px; border-top:1px solid #222228; padding-top:16px; }
  `;

  const body = rows
    .map((row) => {
      const cells = row.cells
        .map((cell) => {
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
      const actuals = data.statements.map((s) => fmt(s[field])).join(' · ');
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
      ${passes} passed · ${failures} failed · ${skipped} not comparable<br>
      <span class="skip">source: ${data.source} · fetched ${data.fetchedAt}</span>
    </div>
    <table>
      <tr><th>Line item</th><th>FY2023</th><th>FY2024</th><th>FY2025</th></tr>
      ${body}
    </table>
    <div class="note">
      <strong>Deliberate definitional differences — not failures:</strong>
      ${diffNotes}
      <p>Blank cells are figures the Excel model leaves empty for that year, so
      there is nothing to compare against.</p>
    </div>
  </body></html>`);
}
