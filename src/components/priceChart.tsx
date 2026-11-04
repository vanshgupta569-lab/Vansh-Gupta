// FILE: src/components/priceChart.tsx
//
// THE PRICE CHART, AND THE RATIOS DRAWN OVER IT (`docs/COMPANY_OVERVIEW_SPEC.md`
// §3; build step 9, job 9.11).
//
// Drawn as plain SVG rather than with a charting library, for the reason the
// rest of this site is written the way it is: a library would decide what to do
// with a gap in the data, and the one thing this chart must never do is join a
// line across a day that has no close, or a ratio that does not exist. Every
// decision about an absence is made in `src/data/priceSeries.ts` and
// `src/data/chartScale.ts`, where the suite can measure it, and this file only
// draws what they return.
//
// TWO SCALES, NEVER ONE. The price has the left axis and the overlay the right,
// and the right axis's labels sit on the left axis's gridlines, so there is one
// set of lines on the plot.
//
// THE DRAW-IN (§3.8, D7) plays once per page view, on the chart's first mount
// within 200px of the viewport: the data's clip opens over 400ms
// (--m-dur-chart), then the price's fill fades in over 200ms. Axes, gridlines
// and the readout are there from the first frame. Never on a range change, an
// overlay, a resize or a return to the tab; never under 640px, on a low-end
// device or under reduced motion.

import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Hint } from './figuresHint';
import { RANGES, OVERLAYS, priceSeries, overlayFor, type RangeKey, type OverlayKey, type Overlay, type PriceSeries } from '../data/priceSeries';
import { filingLabel } from '../data/companyOverview';
import { segmentsOf, yDomain, logOffered, logTicks, xTicks, priceTick, type Gap } from '../data/chartScale';
import { useReducedMotion } from '../design/motion';
import { useConstrained } from '../design/constrained';

const INSET_TOP = 8;
const AXIS_ZONE = 32;
const PLOT = { desktop: 320, phone: 220 };
const RIGHT = { desktop: 64, phone: 52 };
const PHONE_BELOW = 640;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const day = (iso: string) => {
  const d = new Date(`${iso}T00:00:00Z`);
  return isNaN(d.getTime()) ? iso : `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};
const T = (iso: string) => Date.parse(`${iso}T00:00:00Z`);

const fmt = (n: number, unit: 'multiple' | 'percent' | 'currency', symbol: string): string => {
  if (unit === 'percent') return `${n.toFixed(1)}%`;
  if (unit === 'multiple') return `${n.toFixed(n >= 100 ? 0 : 1)}×`;
  const abs = Math.abs(n);
  if (abs >= 1e6) return `${symbol}${(n / 1e6).toFixed(1)}T`;
  if (abs >= 1e3) return `${symbol}${(n / 1e3).toFixed(1)}B`;
  return `${symbol}${n.toFixed(abs < 10 ? 2 : abs < 1000 ? 1 : 0)}`;
};

/** One segmented control (§3.4): a radio group, roving focus, manual select. */
const Segmented: React.FC<{
  label: string;
  items: { key: string; label: string }[];
  value: string;
  onChange: (key: string) => void;
  phone: boolean;
}> = ({ label, items, value, onChange, phone }) => {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex border border-line-control max-w-full overflow-x-auto [scrollbar-width:none]">
      {items.map((it, i) => {
        const on = it.key === value;
        return (
          <button
            key={it.key}
            ref={(el) => { refs.current[i] = el; }}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            data-chart-chip={it.key}
            onClick={() => onChange(it.key)}
            onKeyDown={(e) => {
              const n = items.length;
              const to = e.key === 'ArrowRight' ? (i + 1) % n : e.key === 'ArrowLeft' ? (i - 1 + n) % n : null;
              if (to !== null) {
                e.preventDefault();
                refs.current[to]?.focus();
              }
            }}
            style={{ transition: 'color var(--m-dur-fast) var(--m-ease-standard)', boxShadow: on ? 'inset 0 0 0 1px var(--m-accent)' : undefined }}
            className={`relative shrink-0 ${phone ? 'h-9' : 'h-8'} min-w-11 px-3 text-[13px] whitespace-nowrap cursor-pointer ${
              i ? 'border-l border-line' : ''
            } ${on ? 'bg-panel text-ink font-semibold' : 'text-muted hover:text-ink font-normal'}`}
          >
            <span aria-hidden="true" data-label={it.label} className="invisible block h-0 overflow-hidden font-semibold after:content-[attr(data-label)]" />
            {it.label}
          </button>
        );
      })}
    </div>
  );
};

interface Props {
  payload: any;
  currencySymbol: string;
}

export const PriceChart: React.FC<Props> = ({ payload, currencySymbol }) => {
  const [range, setRange] = useState<RangeKey>('1Y');
  const [overlayKey, setOverlayKey] = useState<OverlayKey | null>(null);
  const [logOn, setLogOn] = useState(false);
  const [width, setWidth] = useState(880);
  const [cursor, setCursor] = useState<number | null>(null);
  const [spoken, setSpoken] = useState('');
  const [tableOpen, setTableOpen] = useState(false);
  // A range has been changed since the chart first drew: changes crossfade.
  const [switched, setSwitched] = useState(false);
  const box = useRef<HTMLDivElement | null>(null);
  const lastSpoke = useRef(0);
  const ids = useId();
  const reduced = useReducedMotion();
  const constrained = useConstrained();

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    let raf = 0;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect?.width;
      if (!w) return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setWidth((old) => (Math.abs(w - old) > 1 ? w : old)));
    });
    ro.observe(el);
    setWidth(el.getBoundingClientRect().width || 880);
    return () => { ro.disconnect(); cancelAnimationFrame(raf); };
  }, []);

  const phone = width < PHONE_BELOW - 48;
  const plotH = phone ? PLOT.phone : PLOT.desktop;
  const height = INSET_TOP + plotH + AXIS_ZONE;

  const series: PriceSeries = useMemo(() => priceSeries(payload, range), [payload, range]);
  const overlay: Overlay | null = useMemo(() => (overlayKey ? overlayFor(payload, overlayKey, series) : null), [payload, overlayKey, series]);
  const values = series.points.map((p) => p.value);
  const canLog = logOffered(range, values);
  const log = canLog && logOn;
  // A range that cannot offer the log scale leaves it off.
  useEffect(() => { if (!canLog) setLogOn(false); }, [canLog]);
  useEffect(() => setCursor(null), [range]);

  // THE DRAW-IN, once per page view (§3.8).
  const [phase, setPhase] = useState<'wait' | 'clip' | 'fill' | 'done'>('wait');
  const animate = !reduced && !constrained && width >= PHONE_BELOW - 48;
  const started = useRef(false);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  useEffect(() => {
    if (started.current || !series.points.length) return;
    if (!animate) { started.current = true; setPhase('done'); return; }
    const el = box.current;
    if (!el || typeof IntersectionObserver === 'undefined') { started.current = true; setPhase('done'); return; }
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting || started.current) return;
        started.current = true;
        io.disconnect();
        requestAnimationFrame(() => {
          setPhase('clip');
          timers.current.push(window.setTimeout(() => setPhase('fill'), 400));
          timers.current.push(window.setTimeout(() => setPhase('done'), 600));
        });
      },
      { rootMargin: '200px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [animate, series.points.length]);

  const geometry = useMemo(() => {
    const pts = series.points;
    if (!pts.length) return null;
    const lin = yDomain(pts.map((p) => p.value), 5);
    let lo = lin.lo, hi = lin.hi, ticks = lin.ticks, step = lin.step;
    if (log) {
      const vmin = Math.min(...pts.map((p) => p.value)), vmax = Math.max(...pts.map((p) => p.value));
      lo = vmin / 1.08;
      hi = vmax * 1.08;
      ticks = logTicks(lo, hi, 5);
      step = Math.min(...ticks.map((t) => Math.abs(t)).filter(Boolean));
    }
    // Left gutter: the widest label plus 8, at least 40, a multiple of 4.
    const widest = Math.max(...ticks.map((t) => priceTick(t, step, currencySymbol).length)) * 7.6;
    const left = Math.max(40, Math.ceil((widest + 8) / 4) * 4);
    const right = phone ? RIGHT.phone : RIGHT.desktop;
    const plotW = Math.max(40, width - left - right);
    const t0 = T(pts[0].date), t1 = T(pts[pts.length - 1].date);
    const span = Math.max(1, t1 - t0);
    const xOf = (iso: string) => left + ((T(iso) - t0) / span) * plotW;
    const xAt = (t: number) => left + ((t - t0) / span) * plotW;
    const yOf = log
      ? (v: number) => INSET_TOP + plotH - ((Math.log(v) - Math.log(lo)) / (Math.log(hi) - Math.log(lo))) * plotH
      : (v: number) => INSET_TOP + plotH - ((v - lo) / (hi - lo)) * plotH;
    const base = INSET_TOP + plotH;

    // GAPS BREAK THE LINE AND THE FILL.
    const { segments, gaps } = segmentsOf(pts, series.grain);
    const path = segments.map((seg) => seg.map((p, i) => `${i ? 'L' : 'M'}${xOf(p.date).toFixed(2)} ${yOf(p.value).toFixed(2)}`).join(' ')).join(' ');
    const area = segments
      .map((seg) => {
        const line = seg.map((p, i) => `${i ? 'L' : 'M'}${xOf(p.date).toFixed(2)} ${yOf(p.value).toFixed(2)}`).join(' ');
        return `${line} L${xOf(seg[seg.length - 1].date).toFixed(2)} ${base} L${xOf(seg[0].date).toFixed(2)} ${base} Z`;
      })
      .join(' ');

    // The overlay's own scale, its labels on the left axis's gridlines.
    const lines = (overlay?.lines ?? []).map((line) => {
      const vs = line.points.map((p) => p.value);
      let a = Math.min(...vs), b = Math.max(...vs);
      const s = (b - a) * 0.08 || Math.abs(b) * 0.08 || 1;
      a -= s;
      b += s;
      const y = (v: number) => INSET_TOP + plotH - ((v - a) / (b - a)) * plotH;
      const atY = (py: number) => a + ((INSET_TOP + plotH - py) / plotH) * (b - a);
      const maxGap = series.grain === 'monthly' ? 70 * 86400000 : 12 * 86400000;
      let d = '';
      let last = -Infinity;
      for (const p of line.points) {
        const at = T(p.date);
        d += `${!d || at - last > maxGap ? 'M' : 'L'}${xOf(p.date).toFixed(2)} ${y(p.value).toFixed(2)} `;
        last = at;
      }
      return { line, d, yOf: y, atY };
    });

    const xt = xTicks(t0, t1, plotW, range === '1M');
    return { pts, lo, hi, ticks, step, left, right, plotW, xOf, xAt, yOf, base, path, area, gaps, lines, xt, t0, t1 };
  }, [series, overlay, width, plotH, phone, log, range, currencySymbol]);

  // Where the readout points: the cursor, or the last close at rest (§3.6).
  const index = geometry ? (cursor === null ? geometry.pts.length - 1 : Math.max(0, Math.min(geometry.pts.length - 1, cursor))) : 0;
  const point = geometry?.pts[index] ?? null;
  const gapHere: Gap | null =
    geometry && cursor !== null && point ? geometry.gaps.find((g) => g.to === point.date && cursor !== null) ?? null : null;

  const readingsAt = (date: string) =>
    (geometry?.lines ?? []).map((l) => {
      let pick: any = null, best = Infinity;
      for (const p of l.line.points) {
        const g = Math.abs(T(p.date) - T(date));
        if (g < best) { best = g; pick = p; }
      }
      return { label: l.line.label, unit: l.line.unit, point: best <= 8 * 86400000 || series.grain === 'monthly' ? pick : null };
    });

  const nearest = useCallback(
    (x: number) => {
      if (!geometry) return null;
      let best = 0, gap = Infinity;
      geometry.pts.forEach((p, i) => {
        const d = Math.abs(geometry.xOf(p.date) - x);
        if (d < gap) { gap = d; best = i; }
      });
      return best;
    },
    [geometry]
  );
  const onPointer = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setCursor(nearest(e.clientX - rect.left));
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (!geometry) return;
    const n = geometry.pts.length;
    const cur = cursor ?? n - 1;
    const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : e.key === 'PageDown' ? 21 : e.key === 'PageUp' ? -21 : 0;
    let next: number | null = null;
    if (step) next = cur + step * (e.shiftKey && Math.abs(step) === 1 ? 5 : 1);
    if (e.key === 'Home') next = 0;
    if (e.key === 'End') next = n - 1;
    if (next === null) return;
    e.preventDefault();
    const at = Math.max(0, Math.min(n - 1, next));
    setCursor(at);
    // Spoken for keyboard moves only, at most once per 500ms.
    const now = performance.now();
    if (now - lastSpoke.current >= 500) {
      lastSpoke.current = now;
      const p = geometry.pts[at];
      setSpoken(`${day(p.date)}, price ${currencySymbol}${p.value.toFixed(2)}`);
    }
  };

  const name = payload?.name || payload?.ticker || 'this company';
  const rangeLabel = RANGES.find((r) => r.key === range)?.label ?? range;
  const desc = useMemo(() => {
    if (!geometry) return '';
    const p = geometry.pts;
    let hiP = p[0], loP = p[0];
    for (const q of p) { if (q.value > hiP.value) hiP = q; if (q.value < loP.value) loP = q; }
    const chg = ((p[p.length - 1].value / p[0].value - 1) * 100).toFixed(1);
    return `${rangeLabel}: first close ${currencySymbol}${p[0].value.toFixed(2)} on ${day(p[0].date)}, last ${currencySymbol}${p[p.length - 1].value.toFixed(2)} on ${day(p[p.length - 1].date)}, high ${currencySymbol}${hiP.value.toFixed(2)} on ${day(hiP.date)}, low ${currencySymbol}${loP.value.toFixed(2)} on ${day(loP.date)}, a change of ${chg}%.${geometry.gaps.length ? ` ${geometry.gaps.length} gap${geometry.gaps.length === 1 ? '' : 's'} in the data.` : ''}`;
  }, [geometry, rangeLabel, currencySymbol]);

  const clip = phase === 'wait' && animate ? 'inset(0 100% 0 0)' : 'inset(0 0 0 0)';
  // What moves, and only while it moves: the clip, then the fill.
  const clipMotion = phase === 'clip' ? 'clip-path var(--m-dur-chart) var(--m-ease-enter)' : 'none';
  const fillMotion = phase === 'fill' ? 'opacity var(--m-dur-base) var(--m-ease-enter)' : 'none';
  const fillOpacity = phase === 'wait' || phase === 'clip' ? (animate ? 0 : 1) : 1;

  return (
    <section aria-label="Price history" data-chart>
      {/* CONTROLS (§3.1, §3.4–3.5): the range on the left; the overlay, its
          label and ⓘ on the right; wrapping to two rows on a narrow panel. */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3 flex-wrap">
          <Segmented label="Range" phone={phone} items={RANGES.map((r) => ({ key: r.key, label: r.label }))} value={range} onChange={(k) => { setRange(k as RangeKey); setSwitched(true); }} />
          {canLog && (
            /* D9: offered only on 10Y and Max when the price moved more than
               twentyfold; linear by default. */
            <button
              type="button"
              aria-pressed={logOn}
              data-chart-log
              onClick={() => setLogOn((v) => !v)}
              className={`${phone ? 'h-9' : 'h-8'} px-3 border text-[13px] cursor-pointer ${logOn ? 'bg-panel border-accent text-ink font-semibold' : 'border-line-control text-muted hover:text-ink'}`}
            >
              Log scale
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 max-w-full">
          <span className="text-[13px] text-muted">Overlay</span>
          <Hint label="What an overlay is">
            <p>Draws one measure against its own axis on the right. Price keeps the left axis.</p>
            <p className="mt-2">
              Every overlay is computed from this company&rsquo;s own filed figures against its own price on the day &mdash;
              nothing is fetched. Each point divides by the filing that was the latest one on that date, dated from its
              period end, because the payload does not carry the day it was published.
            </p>
          </Hint>
          <Segmented
            label="Overlay"
            phone={phone}
            items={[{ key: 'none', label: 'None' }, ...OVERLAYS.map((o) => ({ key: o.key, label: o.label }))]}
            value={overlayKey ?? 'none'}
            onChange={(k) => setOverlayKey(k === 'none' ? null : (k as OverlayKey))}
          />
        </div>
      </div>

      {/* THE CHART, A FIXED HEIGHT IN EVERY STATE (§3.1). */}
      <div ref={box} className="w-full" style={{ height }}>
        {series.missing || !geometry ? (
          <div data-chart-empty className="h-full border border-line flex flex-col items-center justify-center px-5 text-center">
            <p className="text-[15px] text-read">No price history for {name}.</p>
            <p className="mt-1 text-[13px] text-quiet max-w-prose">{series.missing ?? 'The source returned no closes.'}</p>
          </div>
        ) : (
          <div
            tabIndex={0}
            role="group"
            aria-label={`Price chart, ${rangeLabel} to ${day(geometry.pts[geometry.pts.length - 1].date)}`}
            onKeyDown={onKey}
            onBlur={() => setCursor(null)}
            className="h-full"
          >
            <svg
              width={width}
              height={height}
              viewBox={`0 0 ${width} ${height}`}
              role="img"
              aria-labelledby={`${ids}-t ${ids}-d`}
              data-draw-in={phase}
              data-scale={log ? 'log' : 'linear'}
              onPointerMove={(e) => { if (e.pointerType === 'mouse') onPointer(e); }}
              onPointerDown={onPointer}
              onPointerLeave={(e) => { if (e.pointerType === 'mouse') setCursor(null); }}
              className="block touch-pan-y"
            >
              <title id={`${ids}-t`}>{`Price of ${name}, ${rangeLabel}${overlay && !overlay.missing ? `, with ${overlay.label}` : ''}`}</title>
              <desc id={`${ids}-d`}>{desc}</desc>
              <defs>
                <linearGradient id={`${ids}-fill`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--m-ink)" stopOpacity="0.10" />
                  <stop offset="100%" stopColor="var(--m-ink)" stopOpacity="0" />
                </linearGradient>
                <pattern id={`${ids}-hatch`} width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                  <line x1="0" y1="0" x2="0" y2="8" stroke="var(--m-line)" strokeWidth="1" />
                </pattern>
              </defs>

              {/* Gridlines, one per left tick (≤ 5), and the baseline. */}
              {geometry.ticks.map((t) => (
                <g key={`y${t}`}>
                  <line x1={geometry.left} x2={width - geometry.right} y1={geometry.yOf(t)} y2={geometry.yOf(t)} stroke="var(--m-line)" strokeWidth="1" />
                  <text data-axis="left" x={geometry.left - 8} y={geometry.yOf(t) + 4} textAnchor="end" fontSize="13" fill="var(--m-quiet)" className="font-figure tabular-nums">
                    {priceTick(t, geometry.step, currencySymbol)}
                  </text>
                </g>
              ))}
              <line x1={geometry.left} x2={width - geometry.right} y1={geometry.base} y2={geometry.base} stroke="var(--m-line)" strokeWidth="1" />
              {log && (
                <text data-log-note x={geometry.left + 8} y={INSET_TOP + 4 + 13} fontSize="13" fill="var(--m-quiet)">
                  Log scale
                </text>
              )}

              {geometry.lines[0] &&
                geometry.ticks.map((t) => (
                  <text key={`r${t}`} data-axis="right" x={width - geometry.right + 8} y={geometry.yOf(t) + 4} fontSize="13" fill="var(--m-amber)" className="font-figure tabular-nums">
                    {fmt(geometry.lines[0].atY(geometry.yOf(t)), geometry.lines[0].line.unit, currencySymbol)}
                  </text>
                ))}

              {geometry.xt.map((x) => (
                <text
                  key={`x${x.t}`}
                  data-axis="x"
                  x={geometry.xAt(x.t)}
                  y={geometry.base + 8 + 13}
                  textAnchor="middle"
                  fontSize="13"
                  fontWeight={x.landmark ? 600 : 400}
                  fill="var(--m-quiet)"
                  className="font-figure tabular-nums"
                >
                  {x.label}
                </text>
              ))}

              {/* Gaps of four or more expected days: a hatched band between
                  two dotted edges (§3.7). */}
              {geometry.gaps
                .filter((g) => g.band)
                .map((g) => {
                  const x0 = geometry.xOf(g.from), x1 = geometry.xOf(g.to);
                  return (
                    <g key={`gap${g.from}`} data-gap-band>
                      <rect x={x0} y={INSET_TOP} width={Math.max(1, x1 - x0)} height={plotH} fill={`url(#${ids}-hatch)`} />
                      <line x1={x0} x2={x0} y1={INSET_TOP} y2={geometry.base} stroke="var(--m-quiet)" strokeDasharray="1.5 3.5" />
                      <line x1={x1} x2={x1} y1={INSET_TOP} y2={geometry.base} stroke="var(--m-quiet)" strokeDasharray="1.5 3.5" />
                    </g>
                  );
                })}

              {/* THE DATA, the only part that draws in. Keyed by range, so a
                  range change crossfades in 110ms rather than redrawing. */}
              <g
                key={`${range}-${log ? 'log' : 'lin'}`}
                data-chart-data
                style={{
                  clipPath: clip,
                  transition: clipMotion,
                  animation: switched && phase === 'done' && animate ? 'm-fade-in var(--m-dur-fast) var(--m-ease-standard)' : undefined,
                }}
              >
                <path
                  data-price-fill
                  d={geometry.area}
                  fill={`url(#${ids}-fill)`}
                  style={{ opacity: fillOpacity, transition: fillMotion }}
                />
                <path data-price-line d={geometry.path} fill="none" stroke="var(--m-ink)" strokeWidth="1.5" strokeLinejoin="round" />
                {geometry.lines.map((l, i) => (
                  <path
                    key={l.line.label}
                    d={l.d}
                    fill="none"
                    stroke={i === 0 ? 'var(--m-amber)' : 'var(--m-accent-text)'}
                    strokeWidth="1.5"
                    strokeDasharray={i === 0 ? undefined : '4 3'}
                    strokeLinejoin="round"
                  />
                ))}
                {cursor === null && point && (
                  <circle cx={geometry.xOf(point.date)} cy={geometry.yOf(point.value)} r="3.5" fill="var(--m-ink)" />
                )}
              </g>

              {cursor !== null && point && (
                <g data-crosshair>
                  <line x1={geometry.xOf(point.date)} x2={geometry.xOf(point.date)} y1={INSET_TOP} y2={geometry.base} stroke="var(--m-read)" strokeWidth="1" strokeDasharray="4 4" />
                  <circle cx={geometry.xOf(point.date)} cy={geometry.yOf(point.value)} r="3.5" fill="var(--m-ink)" />
                </g>
              )}
            </svg>
          </div>
        )}
      </div>

      {/* THE READOUT (§3.6): one fixed 24px row, the last close at rest. */}
      {geometry && point && (
        <div data-chart-readout className="mt-3 h-6 flex items-baseline gap-x-3 overflow-hidden whitespace-nowrap">
          {gapHere ? (
            <span className="text-[15px] text-read">
              No data {day(gapHere.from)} – {day(gapHere.to)} ({gapHere.missing} {series.grain === 'monthly' ? 'months' : 'trading days'})
            </span>
          ) : (
            <>
              <span className="text-[15px] text-read">{day(point.date)}</span>
              <span className="text-[13px] text-quiet">Price</span>
              <span className="font-figure text-[15px] font-semibold tabular-nums text-ink">
                {currencySymbol}
                {point.value.toFixed(2)}
              </span>
              {readingsAt(point.date).map((r) => (
                <span key={r.label} className="inline-flex items-baseline gap-2">
                  <svg width="16" height="8" aria-hidden="true"><line x1="0" x2="16" y1="4" y2="4" stroke="var(--m-amber)" strokeWidth="1.5" /></svg>
                  <span className="text-[13px] text-quiet">{r.label}</span>
                  {r.point ? (
                    <span className="font-figure text-[15px] tabular-nums text-ink">{fmt(r.point.value, r.unit, currencySymbol)}</span>
                  ) : (
                    <span className="text-[13px] text-quiet">not meaningful on this day</span>
                  )}
                </span>
              ))}
            </>
          )}
        </div>
      )}
      <div aria-live="polite" className="sr-only">{spoken}</div>

      {overlay?.missing && (
        <p className="text-[13px] text-read mt-2 max-w-prose">
          <span className="text-quiet">{overlay.label}: </span>
          {overlay.missing}
        </p>
      )}
      {overlay && !overlay.missing && (
        <p className="text-[13px] text-quiet mt-2 max-w-prose">
          {overlay.label} = {overlay.formula}. {overlay.note}
          {overlay.lines.length > 1 ? ` ${overlay.lines[1].label} is drawn dashed, on its own scale; the right axis is ${overlay.lines[0].label.toLowerCase()}.` : ''}
          {point && readingsAt(point.date)[0]?.point ? ` The reading is on ${filingLabel(readingsAt(point.date)[0].point.filing)}.` : ''}
        </p>
      )}

      {/* THE SOURCE LINE (§3.7), with the count of closes drawn. */}
      <p className="text-[13px] text-quiet mt-2 max-w-prose">
        {series.source}
        {series.quotedCurrency && series.currency && series.quotedCurrency !== series.currency
          ? `, quoted in ${series.quotedCurrency} and shown in ${series.currency} at the one rate the price was converted at, so the level is at today’s rate and the shape is unaffected`
          : ''}
        .{' '}
        <span data-chart-count>
          {series.points.length.toLocaleString('en-US')} {series.grain} closes
        </span>
        .
      </p>

      {/* VIEW DATA AS A TABLE (§3.7): the accessible alternative. */}
      {geometry && (
        <div className="mt-2">
          <button
            type="button"
            aria-expanded={tableOpen}
            onClick={() => setTableOpen((v) => !v)}
            className="h-10 pointer-coarse:h-11 text-[13px] text-muted hover:text-ink cursor-pointer"
          >
            {tableOpen ? 'Hide the table' : 'View data as a table'}
          </button>
          {tableOpen && (
            <div data-chart-table className="max-h-[320px] overflow-y-auto border border-line">
              <table className="w-full text-[13px] tabular-nums">
                <thead className="sticky top-0 bg-panel">
                  <tr className="text-left text-quiet">
                    <th className="px-3 h-8 font-medium">Date</th>
                    <th className="px-3 h-8 font-medium text-right">Close</th>
                    {geometry.lines[0] && <th className="px-3 h-8 font-medium text-right">{geometry.lines[0].line.label}</th>}
                  </tr>
                </thead>
                <tbody>
                  {[...geometry.pts].reverse().map((p) => {
                    const r = geometry.lines[0] ? readingsAt(p.date)[0] : null;
                    return (
                      <tr key={p.date} className="border-t border-line text-read">
                        <td className="px-3 h-8">{day(p.date)}</td>
                        <td className="px-3 h-8 text-right text-ink">{currencySymbol}{p.value.toFixed(2)}</td>
                        {r && <td className="px-3 h-8 text-right">{r.point ? fmt(r.point.value, r.unit, currencySymbol) : 'n.m.'}</td>}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  );
};

export default PriceChart;
