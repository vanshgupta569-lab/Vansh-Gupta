// FILE: src/components/valuationBridge.tsx
//
// THE VALUATION BRIDGE BETWEEN TWO SAVED VERSIONS (build step 5, job C5).
// `docs/STUDIO_SPEC.md` §4.6; `docs/VALUATION_SIDE_BY_SIDE_SPEC.md` Part 2,
// rules 15 to 24. The arithmetic is `src/data/bridge.ts` (jobs C1–C3) and the
// worker that runs it is `bridgeRunner.ts` (C4); this file only shows it.
//
// WHAT THE SCREEN HAS TO GET RIGHT, and why each is here rather than implied:
//
//   1. THE PARTS ADD UP, VISIBLY (rule 17). A Shapley attribution whose parts
//      do not sum to the change it explains is worthless, and a reader cannot
//      check that by eye across nine rows. So the sum is printed, beside the
//      total, with a tick — and the figures summed are the ROUNDED ones the
//      table prints, not the unrounded ones behind them. Largest-remainder
//      rounding is what makes those two the same number (C2).
//
//   2. "ASSOCIATED WITH", NEVER "CAUSED BY" (rule 22). Shapley says how much
//      of the change goes with a driver across every order of applying them.
//      It is an accounting identity, not a finding about the world: the same
//      number arises whether the reader changed the WACC because the price
//      moved or in spite of it. "Caused" is a claim this arithmetic cannot
//      make, and standing decision 6 — explain mechanics, not merit — is the
//      same rule one level up.
//
//   3. THE METHOD IS ON THE SCREEN (rule 23), not in a tooltip. A reader who
//      does not know what an average across orders is cannot evaluate the
//      number, and hiding the sentence does not make them know it.
//
//   4. SIGN IS CARRIED BY THE LABEL AND THE DIRECTION, NOT BY COLOUR (§4.6).
//      Increases read, decreases quiet and outlined. Nobody has to see green
//      and red to read this, and `DESIGN.md` bans the pair anyway.
//
//   5. "n.m." WHERE THE TOTAL IS NEAR ZERO (rule 19). Two versions worth the
//      same leave every driver dividing by about nothing, and a share of 4,000%
//      is arithmetic that has stopped meaning anything.
//
// The phone layout is a horizontal waterfall with a pinned total (rule 24):
// the vertical one needs a y-axis a phone has no room for, and a row that says
// `WACC 10.0% → 9.0%  −$12.40` says the same thing in the width available.
import React, { useMemo } from 'react';
import { EYEBROW, UI, BODY } from './instrument';
import type { BridgeResult } from '../data/bridge';
import { shareOfTotal } from '../data/bridge';

export interface ValuationBridgeProps {
  result: BridgeResult | null;
  /** What the two versions are called, for the start and end bars. */
  labelA: string;
  labelB: string;
  currencySymbol: string;
  /** Shown while the worker is running (C4). */
  building?: boolean;
  /** The engine's words when the bridge could not be built at all. */
  error?: string | null;
}

const isNum = (v: unknown): v is number => typeof v === 'number' && isFinite(v);

/** The metric's own name, because the bridge explains one and says which. */
const METRIC_LABEL: Record<string, string> = {
  perpetuity: 'value per share, perpetuity growth',
  exitMultiple: 'value per share, exit multiple',
};

export const ValuationBridge: React.FC<ValuationBridgeProps> = ({
  result,
  labelA,
  labelB,
  currencySymbol,
  building = false,
  error = null,
}) => {
  const money = (v: number | null | undefined, dp = 2) =>
    isNum(v)
      ? `${currencySymbol}${v.toLocaleString('en-US', {
          minimumFractionDigits: dp,
          maximumFractionDigits: dp,
        })}`
      : '—';

  // A signed figure reads as a change rather than as a quantity, and U+2212 is
  // the minus sign (G10) — the hyphen on the keyboard is not one.
  const signed = (v: number | null | undefined, dp = 2) => {
    if (!isNum(v)) return '—';
    const sign = v > 0 ? '+' : v < 0 ? '−' : '';
    return `${sign}${currencySymbol}${Math.abs(v).toLocaleString('en-US', {
      minimumFractionDigits: dp,
      maximumFractionDigits: dp,
    })}`;
  };

  const rows = useMemo(() => {
    if (!result?.ok) return [];
    const byKey = new Map(result.drivers.map((d) => [d.key, d]));
    return result.parts
      .map((p) => ({ part: p, driver: byKey.get(p.key) }))
      .filter((r) => r.driver)
      // Sorted by absolute size (§4.6): the reader's question is "what moved
      // this", and the answer is at the top rather than wherever the driver
      // list happened to put it.
      .sort((a, b) => Math.abs(b.part.rounded) - Math.abs(a.part.rounded));
  }, [result]);

  if (building) {
    return (
      <section className="border border-line bg-panel p-6" data-bridge="building">
        <div className={`${EYEBROW} text-quiet uppercase tracking-[0.2em]`}>Valuation bridge</div>
        <p className={`${BODY} text-read mt-3 max-w-prose`}>
          Working out each driver's share. Every combination of the changes is valued, so this takes a
          few seconds and the answer appears once, finished.
        </p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="border border-line bg-panel p-6" data-bridge="error">
        <div className={`${EYEBROW} text-quiet uppercase tracking-[0.2em]`}>Valuation bridge</div>
        <p className={`${BODY} text-read mt-3 max-w-prose`}>{error}</p>
      </section>
    );
  }

  if (!result?.ok || !isNum(result.total) || !isNum(result.start) || !isNum(result.end)) {
    return (
      <section className="border border-line bg-panel p-6" data-bridge="unavailable">
        <div className={`${EYEBROW} text-quiet uppercase tracking-[0.2em]`}>Valuation bridge</div>
        <p className={`${BODY} text-read mt-3 max-w-prose`}>
          A bridge needs two saved versions of the same model that both produce a value. This pair does
          not, so nothing is shown rather than a figure that means nothing.
        </p>
      </section>
    );
  }

  const total = result.totalRounded ?? result.total;
  // THE RECONCILIATION (rule 17), summed from the ROUNDED parts the table
  // prints. Summing the unrounded ones would always tie and would prove
  // nothing about what is on the screen.
  const partsSum = result.parts.reduce((t, p) => t + p.rounded, 0);
  const ties = Math.abs(partsSum - total) < 0.005;

  // "% of total" is meaningless when the total is near zero (rule 19). THE
  // RULE IS ASKED OF `bridge.ts`, not reimplemented here: a second copy of a
  // published threshold is how the screen and the engine come to disagree
  // about what `n.m.` means, and `shareOfTotal` already owns it.
  const share = (v: number) => {
    const s = shareOfTotal(v, total, result.start as number);
    return s === null ? 'n.m.' : `${(s * 100).toFixed(1)}%`;
  };

  // The waterfall's scale: the start, the end, and every running balance in
  // between, so no bar leaves the frame.
  const marks: number[] = [result.start];
  let running = result.start;
  for (const r of rows) {
    running += r.part.rounded;
    marks.push(running);
  }
  marks.push(result.end);
  const lo = Math.min(...marks);
  const hi = Math.max(...marks);
  const span = hi - lo || 1;
  const pos = (v: number) => ((v - lo) / span) * 100;

  return (
    <section className="border border-line bg-panel p-6" data-bridge="shown">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <div className={`${EYEBROW} text-quiet uppercase tracking-[0.2em]`}>Valuation bridge</div>
        <div className={`${UI} text-quiet`} data-bridge-metric>
          {METRIC_LABEL[result.metric] ?? result.metric}
        </div>
      </div>

      <p className={`${BODY} text-read mt-3 max-w-prose`} data-bridge-wording>
        What is <span className="text-ink">associated with</span> the change from {labelA} to {labelB}.
      </p>

      {/* ---- THE WATERFALL -------------------------------------------- */}
      {/* Desktop: vertical, start bar, one bar per driver, end bar. The phone
          layout below carries the same figures as rows, because a vertical
          waterfall needs an axis a 390px screen has no room for. */}
      <div className="mt-6 hidden sm:block" data-bridge-waterfall>
        <Bar label={labelA} left={0} width={pos(result.start)} tone="end" figure={money(result.start)} />
        {(() => {
          let at = result.start;
          return rows.map((r) => {
            const from = at;
            at += r.part.rounded;
            const up = r.part.rounded >= 0;
            const left = pos(Math.min(from, at));
            const width = Math.max(Math.abs(pos(at) - pos(from)), 0.4);
            return (
              <Bar
                key={r.part.key}
                label={r.driver!.label}
                left={left}
                width={width}
                tone={up ? 'up' : 'down'}
                figure={signed(r.part.rounded)}
                dataKey={r.part.key}
              />
            );
          });
        })()}
        <Bar label={labelB} left={0} width={pos(result.end)} tone="end" figure={money(result.end)} />
      </div>

      {/* ---- THE PHONE WATERFALL (rule 24) ---------------------------- */}
      <div className="mt-5 sm:hidden" data-bridge-phone>
        {rows.map((r) => (
          <div key={r.part.key} className="border-b border-line py-2.5" data-bridge-phone-row>
            <div className="flex items-baseline justify-between gap-3">
              <span className={`${UI} text-ink`}>{r.driver!.label}</span>
              <span className={`${EYEBROW} text-ink tabular-nums`}>{signed(r.part.rounded)}</span>
            </div>
            <div className={`${UI} text-quiet mt-0.5`}>
              {r.driver!.from} {'→'} {r.driver!.to}
            </div>
          </div>
        ))}
        {/* Pinned, because the total is what every row is a share of. */}
        <div className="sticky bottom-0 bg-panel border-t border-line py-2.5 flex items-baseline justify-between gap-3">
          <span className={`${UI} text-ink`}>Total change</span>
          <span className={`${EYEBROW} text-ink tabular-nums`}>{signed(total)}</span>
        </div>
      </div>

      {/* ---- THE TABLE (§4.6) ----------------------------------------- */}
      <div className="mt-6 overflow-x-auto hidden sm:block">
        <table className="w-full border-collapse" data-bridge-table>
          <thead>
            <tr className="border-b border-line">
              {['Driver', labelA, labelB, 'Value change', '% of total'].map((h, i) => (
                <th
                  key={h}
                  className={`${EYEBROW} text-quiet uppercase tracking-[0.1em] py-2 ${
                    i === 0 ? 'text-left' : 'text-right'
                  }`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.part.key} className="border-b border-line" data-bridge-row={r.part.key}>
                <td className={`${UI} text-ink py-2`}>{r.driver!.label}</td>
                <td className={`${UI} text-read py-2 text-right`}>{r.driver!.from}</td>
                <td className={`${UI} text-read py-2 text-right`}>{r.driver!.to}</td>
                <td className={`${EYEBROW} text-ink py-2 text-right tabular-nums`} data-bridge-part>
                  {signed(r.part.rounded)}
                </td>
                <td className={`${UI} text-read py-2 text-right tabular-nums`} data-bridge-share>
                  {share(r.part.rounded)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ---- PARTS = TOTAL (rule 17) ---------------------------------- */}
      <div
        className={`${EYEBROW} ${ties ? 'text-ink' : 'text-accent-text'} mt-4 tabular-nums`}
        data-bridge-tie
      >
        Parts {signed(partsSum)} = total {signed(total)} {ties ? '✓' : '✗'}
      </div>

      {/* ---- THE METHOD (rule 23) ------------------------------------- */}
      <p className={`${BODY} text-quiet mt-3 max-w-prose`} data-bridge-method>
        Each driver's share is its average effect across all orders of applying the changes.
        {result.method === 'exact'
          ? ` Every one of the ${result.runs.toLocaleString('en-US')} combinations was valued.`
          : ` Too many drivers to value every combination, so ${(result.orders ?? 0).toLocaleString(
              'en-US'
            )} orders were sampled from a fixed seed — the same two versions always give the same answer.`}
      </p>

      {/* What the bridge could not explain, said rather than dropped. */}
      {result.notBridged.length > 0 && (
        <ul className={`${UI} text-quiet mt-2 space-y-1`} data-bridge-not-bridged>
          {result.notBridged.map((n) => (
            <li key={n.input}>{n.why}</li>
          ))}
        </ul>
      )}
      {result.refused.length > 0 && (
        <p className={`${UI} text-quiet mt-2 max-w-prose`} data-bridge-refused>
          {result.refused.length} combination{result.refused.length === 1 ? '' : 's'} could not be
          valued and {result.refused.length === 1 ? 'is' : 'are'} reported rather than skipped:{' '}
          {result.refused[0].refusal}
        </p>
      )}
    </section>
  );
};

/** One bar of the vertical waterfall. */
const Bar: React.FC<{
  label: string;
  left: number;
  width: number;
  tone: 'up' | 'down' | 'end';
  figure: string;
  dataKey?: string;
}> = ({ label, left, width, tone, figure, dataKey }) => (
  <div className="flex items-center gap-4 py-1.5" data-bridge-bar={dataKey ?? 'end'}>
    <span className={`${UI} text-read w-40 shrink-0 truncate`}>{label}</span>
    <span className="relative h-5 flex-1 bg-page">
      <span
        className={`absolute inset-y-0 ${
          tone === 'end'
            ? 'bg-ink/20 border border-line'
            : tone === 'up'
              ? 'bg-read/35 border border-read/60'
              : 'border border-quiet/70 border-dashed'
        }`}
        style={{ left: `${left}%`, width: `${width}%` }}
      />
    </span>
    <span className={`${EYEBROW} text-ink w-28 shrink-0 text-right tabular-nums`}>{figure}</span>
  </div>
);

export default ValuationBridge;
