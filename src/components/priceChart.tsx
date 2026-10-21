// FILE: src/components/priceChart.tsx
//
// THE PRICE CHART, AND THE RATIOS DRAWN OVER IT.
//
// Drawn as plain SVG rather than with a charting library, for the reason the
// rest of this site is written the way it is: a library would decide what to do
// with a gap in the data, and the one thing this chart must never do is join a
// line across a ratio that does not exist. Every decision about an absence is
// made in `src/data/priceSeries.ts`, where the suite can measure it, and this
// file only draws what that returns.
//
// TWO SCALES, NEVER ONE. The price has the left axis and the overlay the right,
// because a price-to-earnings of 46 and a price of $344 on one axis would make
// one of them a flat line against the bottom. Where an overlay carries two
// lines — sales and the margin on it — each gets its own scale and the legend
// says so, rather than pretending a percentage and a revenue share an axis.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EYEBROW, UI } from './instrument';
import { Hint } from './figuresHint';
import {
  RANGES,
  OVERLAYS,
  priceSeries,
  overlayFor,
  type RangeKey,
  type OverlayKey,
  type Overlay,
  type PriceSeries,
} from '../data/priceSeries';
import { filingLabel } from '../data/companyOverview';

const PAD = { left: 52, right: 56, top: 14, bottom: 22 };
const HEIGHT = 300;
const PHONE_HEIGHT = 210;

const niceTicks = (min: number, max: number, count = 4): number[] => {
  if (!isFinite(min) || !isFinite(max) || min === max) return [min];
  const raw = (max - min) / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
  const out: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + step / 1000; v += step) out.push(v);
  return out.length ? out : [min, max];
};

const shortDate = (iso: string) => {
  const d = new Date(`${iso}T00:00:00Z`);
  return isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
};

const axisDate = (iso: string, span: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  if (isNaN(d.getTime())) return iso;
  const opts: Intl.DateTimeFormatOptions =
    span > 3 * 365 * 86400000
      ? { year: 'numeric', timeZone: 'UTC' }
      : span > 200 * 86400000
        ? { month: 'short', year: '2-digit', timeZone: 'UTC' }
        : { day: 'numeric', month: 'short', timeZone: 'UTC' };
  return d.toLocaleDateString('en-GB', opts);
};

const fmt = (n: number, unit: 'multiple' | 'percent' | 'currency', symbol: string): string => {
  if (unit === 'percent') return `${n.toFixed(1)}%`;
  if (unit === 'multiple') return `${n.toFixed(n >= 100 ? 0 : 1)}×`;
  const abs = Math.abs(n);
  if (abs >= 1e6) return `${symbol}${(n / 1e6).toFixed(1)}T`;
  if (abs >= 1e3) return `${symbol}${(n / 1e3).toFixed(1)}B`;
  return `${symbol}${n.toFixed(abs < 10 ? 2 : abs < 1000 ? 1 : 0)}`;
};

interface Props {
  payload: any;
  currencySymbol: string;
}

export const PriceChart: React.FC<Props> = ({ payload, currencySymbol }) => {
  const [range, setRange] = useState<RangeKey>('1Y');
  const [overlayKey, setOverlayKey] = useState<OverlayKey | null>(null);
  const [width, setWidth] = useState(880);
  const [hoverX, setHoverX] = useState<number | null>(null);
  const box = useRef<HTMLDivElement | null>(null);

  // The drawing needs a pixel width, and a chart that assumes one is a chart
  // that is wrong on every screen but the author's.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect?.width;
      if (w && Math.abs(w - width) > 1) setWidth(w);
    });
    ro.observe(el);
    setWidth(el.getBoundingClientRect().width || 880);
    return () => ro.disconnect();
  }, [width]);

  const phone = width < 560;
  const height = phone ? PHONE_HEIGHT : HEIGHT;
  const pad = phone ? { ...PAD, left: 44, right: 44 } : PAD;

  const series: PriceSeries = useMemo(() => priceSeries(payload, range), [payload, range]);
  const overlay: Overlay | null = useMemo(
    () => (overlayKey ? overlayFor(payload, overlayKey, series) : null),
    [payload, overlayKey, series]
  );

  const plotW = Math.max(40, width - pad.left - pad.right);
  const plotH = height - pad.top - pad.bottom;

  const geometry = useMemo(() => {
    const pts = series.points;
    if (!pts.length) return null;
    const t0 = Date.parse(`${pts[0].date}T00:00:00Z`);
    const t1 = Date.parse(`${pts[pts.length - 1].date}T00:00:00Z`);
    const span = Math.max(1, t1 - t0);
    const xOf = (iso: string) => pad.left + ((Date.parse(`${iso}T00:00:00Z`) - t0) / span) * plotW;

    const values = pts.map((p) => p.value);
    let lo = Math.min(...values);
    let hi = Math.max(...values);
    const slack = (hi - lo) * 0.08 || Math.abs(hi) * 0.08 || 1;
    lo -= slack;
    hi += slack;
    const yOf = (v: number) => pad.top + plotH - ((v - lo) / (hi - lo)) * plotH;

    const path = pts.map((p, i) => `${i ? 'L' : 'M'}${xOf(p.date).toFixed(2)} ${yOf(p.value).toFixed(2)}`).join(' ');
    const area = `${path} L${xOf(pts[pts.length - 1].date).toFixed(2)} ${(pad.top + plotH).toFixed(2)} L${xOf(
      pts[0].date
    ).toFixed(2)} ${(pad.top + plotH).toFixed(2)} Z`;

    // THE OVERLAY'S OWN SCALE, one per line, so neither is flattened.
    const lines = (overlay?.lines ?? []).map((line) => {
      const vs = line.points.map((p) => p.value);
      let a = Math.min(...vs);
      let b = Math.max(...vs);
      const s = (b - a) * 0.08 || Math.abs(b) * 0.08 || 1;
      a -= s;
      b += s;
      const y = (v: number) => pad.top + plotH - ((v - a) / (b - a)) * plotH;
      // GAPS ARE GAPS. A year with no filing, or a loss year with no
      // price-to-earnings, breaks the line instead of being bridged across.
      let d = '';
      let open = false;
      let last = -Infinity;
      const maxGap = series.grain === 'monthly' ? 70 * 86400000 : 12 * 86400000;
      for (const p of line.points) {
        const at = Date.parse(`${p.date}T00:00:00Z`);
        const cmd = !open || at - last > maxGap ? 'M' : 'L';
        d += `${cmd}${xOf(p.date).toFixed(2)} ${y(p.value).toFixed(2)} `;
        open = true;
        last = at;
      }
      return { line, d, lo: a, hi: b, yOf: y };
    });

    return { pts, t0, t1, span, xOf, yOf, lo, hi, path, area, lines };
  }, [series, overlay, pad.left, pad.top, plotW, plotH]);

  const onMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement> | React.TouchEvent<SVGSVGElement>) => {
      const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
      const clientX = 'touches' in e ? e.touches[0]?.clientX : (e as React.MouseEvent).clientX;
      if (clientX === undefined) return;
      setHoverX(clientX - rect.left);
    },
    []
  );

  const at = useMemo(() => {
    if (!geometry || hoverX === null) return null;
    const ratio = Math.min(1, Math.max(0, (hoverX - pad.left) / plotW));
    const want = geometry.t0 + ratio * geometry.span;
    let best = geometry.pts[0];
    let bestGap = Infinity;
    for (const p of geometry.pts) {
      const gap = Math.abs(Date.parse(`${p.date}T00:00:00Z`) - want);
      if (gap < bestGap) {
        bestGap = gap;
        best = p;
      }
    }
    const readings = (geometry.lines ?? []).map((l) => {
      let pick = null as null | { value: number; filing: any; date: string };
      let gap = Infinity;
      for (const p of l.line.points) {
        const g = Math.abs(Date.parse(`${p.date}T00:00:00Z`) - Date.parse(`${best.date}T00:00:00Z`));
        if (g < gap) {
          gap = g;
          pick = p;
        }
      }
      return { label: l.line.label, unit: l.line.unit, point: gap <= 8 * 86400000 || series.grain === 'monthly' ? pick : null };
    });
    return { point: best, readings };
  }, [geometry, hoverX, pad.left, plotW, series.grain]);

  const chips = (items: { key: string; label: string; on: boolean; set: () => void }[]) => (
    <div className="flex flex-wrap items-center gap-1">
      {items.map((c) => (
        <button
          key={c.key}
          type="button"
          onClick={c.set}
          aria-pressed={c.on}
          className={`${EYEBROW} border px-2.5 py-1 transition-colors cursor-pointer whitespace-nowrap ${
            c.on
              ? 'border-accent/60 bg-accent/15 text-ink'
              : 'border-line bg-transparent text-muted hover:border-quiet/60 hover:text-ink'
          }`}
        >
          {c.label}
        </button>
      ))}
    </div>
  );

  const ticksY = geometry ? niceTicks(geometry.lo, geometry.hi, phone ? 3 : 4) : [];
  const overlayScale = geometry?.lines?.[0] ?? null;
  const ticksR = overlayScale ? niceTicks(overlayScale.lo, overlayScale.hi, phone ? 3 : 4) : [];
  const ticksX = geometry
    ? Array.from({ length: phone ? 3 : 5 }, (_, i) => {
        const idx = Math.round((i / ((phone ? 3 : 5) - 1)) * (geometry.pts.length - 1));
        return geometry.pts[idx];
      })
    : [];

  return (
    <section aria-label="Price history">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        {chips(RANGES.map((r) => ({ key: r.key, label: r.label, on: range === r.key, set: () => setRange(r.key) })))}
        <div className="flex items-center gap-2">
          <span className={`${EYEBROW} text-quiet`}>Overlay</span>
          {chips([
            { key: 'none', label: 'None', on: overlayKey === null, set: () => setOverlayKey(null) },
            ...OVERLAYS.map((o) => ({
              key: o.key,
              label: o.label,
              on: overlayKey === o.key,
              set: () => setOverlayKey(o.key),
            })),
          ])}
          <Hint label="How these overlays are worked out">
            <p>
              Every overlay is computed from this company&rsquo;s own filed figures against its own price on the
              day &mdash; nothing is fetched. Each point divides by the filing that was the latest one on that
              date, and the readout names it.
            </p>
            <p className="mt-2">
              A filing is dated from its period end, because the payload does not carry the day it was
              published. For the weeks between a year end and the annual report, a point therefore uses
              figures the market did not have yet.
            </p>
          </Hint>
        </div>
      </div>

      <div ref={box} className="w-full">
        {series.missing || !geometry ? (
          <div className="border border-line bg-panel px-5 py-8">
            <div className={`${EYEBROW} text-quiet mb-2`}>NO CHART</div>
            <p className={`${UI} text-read max-w-prose`}>{series.missing ?? 'There is nothing to draw.'}</p>
          </div>
        ) : (
          <svg
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            role="img"
            aria-label={`Price over ${range}${overlay && !overlay.missing ? `, with ${overlay.label}` : ''}`}
            onMouseMove={onMove}
            onMouseLeave={() => setHoverX(null)}
            onTouchStart={onMove}
            onTouchMove={onMove}
            className="block touch-pan-y"
          >
            <defs>
              <linearGradient id="priceFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--m-ink)" stopOpacity="0.10" />
                <stop offset="100%" stopColor="var(--m-ink)" stopOpacity="0" />
              </linearGradient>
            </defs>

            {ticksY.map((t) => (
              <g key={`y${t}`}>
                <line
                  x1={pad.left}
                  x2={width - pad.right}
                  y1={geometry.yOf(t)}
                  y2={geometry.yOf(t)}
                  stroke="var(--m-line)"
                  strokeWidth="1"
                />
                <text
                  x={pad.left - 8}
                  y={geometry.yOf(t) + 4}
                  textAnchor="end"
                  fontSize="11"
                  fill="var(--m-quiet)"
                  className="font-figure tabular-nums"
                >
                  {fmt(t, 'currency', currencySymbol)}
                </text>
              </g>
            ))}

            {overlayScale &&
              ticksR.map((t) => (
                <text
                  key={`r${t}`}
                  x={width - pad.right + 8}
                  y={overlayScale.yOf(t) + 4}
                  textAnchor="start"
                  fontSize="11"
                  fill="var(--m-amber)"
                  className="font-figure tabular-nums"
                >
                  {fmt(t, overlayScale.line.unit, currencySymbol)}
                </text>
              ))}

            {ticksX.map((p, i) => (
              <text
                key={`x${p.date}${i}`}
                x={geometry.xOf(p.date)}
                y={height - 6}
                textAnchor={i === 0 ? 'start' : i === ticksX.length - 1 ? 'end' : 'middle'}
                fontSize="11"
                fill="var(--m-quiet)"
                className="font-figure tabular-nums"
              >
                {axisDate(p.date, geometry.span)}
              </text>
            ))}

            <path d={geometry.area} fill="url(#priceFill)" />
            <path d={geometry.path} fill="none" stroke="var(--m-ink)" strokeWidth="1.5" strokeLinejoin="round" />

            {geometry.lines.map((l, i) => (
              <path
                key={l.line.label}
                d={l.d}
                fill="none"
                stroke={i === 0 ? 'var(--m-amber)' : 'var(--m-accent-text)'}
                strokeWidth="1.25"
                strokeDasharray={i === 0 ? undefined : '4 3'}
                strokeLinejoin="round"
              />
            ))}

            {at && (
              <g>
                <line
                  x1={geometry.xOf(at.point.date)}
                  x2={geometry.xOf(at.point.date)}
                  y1={pad.top}
                  y2={pad.top + plotH}
                  stroke="var(--m-quiet)"
                  strokeWidth="1"
                  strokeDasharray="3 3"
                />
                <circle cx={geometry.xOf(at.point.date)} cy={geometry.yOf(at.point.value)} r="3" fill="var(--m-ink)" />
              </g>
            )}
          </svg>
        )}
      </div>

      {/* THE READOUT, ALWAYS IN THE SAME PLACE. A tooltip that follows the
          pointer makes the reader's eye chase it; this sits under the chart and
          holds the last place they looked. */}
      {geometry && (
        <div data-chart-readout className="mt-2 flex flex-wrap items-baseline gap-x-5 gap-y-1 min-h-[22px]">
          {at ? (
            <>
              <span className={`${EYEBROW} text-quiet`}>{shortDate(at.point.date)}</span>
              <span className="font-figure text-[15px] tabular-nums text-ink">
                {currencySymbol}
                {at.point.value.toFixed(2)}
              </span>
              {at.readings.map((r) =>
                r.point ? (
                  <span key={r.label} className={`${UI} text-muted`}>
                    <span style={{ color: 'var(--m-amber)' }}>{r.label}</span>{' '}
                    <span className="font-figure tabular-nums text-ink">{fmt(r.point.value, r.unit, currencySymbol)}</span>{' '}
                    <span className="text-quiet">on {filingLabel(r.point.filing)}</span>
                  </span>
                ) : (
                  <span key={r.label} className={`${UI} text-quiet`}>
                    {r.label} &mdash; no filing in effect on that day
                  </span>
                )
              )}
            </>
          ) : (
            <span className={`${UI} text-quiet`}>
              {series.points.length.toLocaleString('en-US')} {series.grain} closes
              {series.grain === 'monthly' ? ', which is what the source gives for a full history' : ''}. Point at
              the chart to read a day.
            </span>
          )}
        </div>
      )}

      {overlay?.missing && (
        <p className={`${UI} text-read mt-2 max-w-prose`}>
          <span className="text-quiet">{overlay.label}: </span>
          {overlay.missing}
        </p>
      )}
      {overlay && !overlay.missing && (
        <p className={`${UI} text-quiet mt-2 max-w-prose`}>
          {overlay.label} = {overlay.formula}. {overlay.note}
          {overlay.lines.length > 1
            ? ` ${overlay.lines[1].label} is drawn dashed, on its own scale; the right axis is ${overlay.lines[0].label.toLowerCase()}.`
            : ''}
        </p>
      )}

      <p className={`${UI} text-quiet mt-2 max-w-prose`}>
        {series.source}
        {series.quotedCurrency && series.currency && series.quotedCurrency !== series.currency
          ? `, quoted in ${series.quotedCurrency} and shown in ${series.currency} at the one rate the price was converted at, so the level is at today’s rate and the shape is unaffected`
          : ''}
        .
      </p>
    </section>
  );
};

export default PriceChart;
