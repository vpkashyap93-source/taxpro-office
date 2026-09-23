"use client";

import { useEffect, useId, useRef, useState } from "react";
import { formatINR, formatINRCompact } from "@/lib/money";

export interface SeriesDef {
  key: string;
  label: string;
  color: string;
}

/** Measures the container so SVG text renders at true pixel size instead of being scaled. */
function useWidth(initial = 640) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(initial);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => e && setW(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, w };
}

/** "Nice" axis maximum and tick step for money values in paise. */
function niceScale(max: number, ticks = 4) {
  if (max <= 0) return { top: 100_00 * ticks, step: 100_00 };
  const raw = max / ticks;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
  return { top: step * ticks, step };
}

/**
 * Grouped column chart (one baseline, one axis). Columns ≤ 24px with 4px rounded data-ends,
 * 2px gap between neighbours, recessive hairline grid, hover tooltip per group, legend for ≥ 2 series.
 */
export function GroupedBarChart({
  data,
  series,
  height = 240,
  ariaLabel,
}: {
  data: { label: string; values: Record<string, number> }[];
  series: SeriesDef[];
  height?: number;
  ariaLabel: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const { ref, w: W } = useWidth();
  const max = Math.max(0, ...data.flatMap((d) => series.map((s) => d.values[s.key] ?? 0)));
  const { top, step } = niceScale(max);
  const H = height;
  const pad = { l: 52, r: 8, t: 12, b: 28 };
  const plotW = W - pad.l - pad.r;
  const plotH = H - pad.t - pad.b;
  const band = plotW / Math.max(1, data.length);
  const barW = Math.min(24, (band * 0.62 - 2 * (series.length - 1)) / series.length);
  const groupW = barW * series.length + 2 * (series.length - 1);
  const y = (v: number) => pad.t + plotH - (v / top) * plotH;
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);

  const bar = (x: number, v: number) => {
    const h = Math.max(0, (v / top) * plotH);
    if (h < 0.5) return "";
    const r = Math.min(4, h, barW / 2);
    const yb = pad.t + plotH;
    const yt = yb - h;
    return `M${x},${yb} V${yt + r} Q${x},${yt} ${x + r},${yt} H${x + barW - r} Q${x + barW},${yt} ${x + barW},${yt + r} V${yb} Z`;
  };

  return (
    <div className="relative" ref={ref}>
      <Legend series={series} />
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={ariaLabel} onMouseLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--color-line)" strokeWidth={1} />
            <text x={pad.l - 8} y={y(t)} textAnchor="end" dominantBaseline="central" className="fill-ink-3 text-[11px] tnum">
              {formatINRCompact(t)}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const gx = pad.l + band * i + (band - groupW) / 2;
          return (
            <g key={d.label}>
              {hover === i && <rect x={pad.l + band * i + 2} y={pad.t} width={band - 4} height={plotH} rx={6} fill="var(--color-navy-50)" />}
              {series.map((s, si) => (
                <path key={s.key} d={bar(gx + si * (barW + 2), d.values[s.key] ?? 0)} fill={s.color} />
              ))}
              <text x={pad.l + band * i + band / 2} y={H - 8} textAnchor="middle" className="fill-ink-3 text-[11.5px]">
                {d.label}
              </text>
              <rect
                x={pad.l + band * i}
                y={pad.t}
                width={band}
                height={plotH + pad.b}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                tabIndex={0}
                aria-label={`${d.label}: ${series.map((s) => `${s.label} ${formatINR(d.values[s.key] ?? 0)}`).join(", ")}`}
              />
            </g>
          );
        })}
      </svg>
      {hover !== null && data[hover] && (
        <div
          className="pointer-events-none absolute top-8 z-10 min-w-40 rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-[var(--shadow-raised)]"
          style={{ left: `${Math.min(78, Math.max(4, ((pad.l + band * hover + band / 2) / W) * 100 - 10))}%` }}
        >
          <div className="mb-1 font-semibold text-ink">{data[hover].label}</div>
          {series.map((s) => (
            <div key={s.key} className="flex items-center justify-between gap-4 text-ink-2">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm" style={{ background: s.color }} />
                {s.label}
              </span>
              <span className="tnum font-medium text-ink">{formatINR(data[hover].values[s.key] ?? 0)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Single-series area/line trend with crosshair tooltip. */
export function TrendChart({ data, color = "var(--chart-billed)", height = 200, ariaLabel }: { data: { label: string; value: number }[]; color?: string; height?: number; ariaLabel: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const gid = useId().replace(/:/g, "");
  const { ref, w: W } = useWidth();
  const H = height;
  const pad = { l: 52, r: 16, t: 14, b: 28 };
  const plotW = W - pad.l - pad.r;
  const plotH = H - pad.t - pad.b;
  const { top, step } = niceScale(Math.max(0, ...data.map((d) => d.value)));
  const x = (i: number) => pad.l + (data.length <= 1 ? plotW / 2 : (plotW * i) / (data.length - 1));
  const y = (v: number) => pad.t + plotH - (v / top) * plotH;
  const line = data.map((d, i) => `${i ? "L" : "M"}${x(i)},${y(d.value)}`).join(" ");
  const area = data.length ? `${line} L${x(data.length - 1)},${pad.t + plotH} L${x(0)},${pad.t + plotH} Z` : "";
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
  const last = data.length - 1;

  return (
    <div className="relative" ref={ref}>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={ariaLabel} onMouseLeave={() => setHover(null)}>
        <defs>
          <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.14} />
            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--color-line)" />
            <text x={pad.l - 8} y={y(t)} textAnchor="end" dominantBaseline="central" className="fill-ink-3 text-[11px] tnum">
              {formatINRCompact(t)}
            </text>
          </g>
        ))}
        <path d={area} fill={`url(#${gid})`} />
        <path d={line} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={pad.t + plotH} stroke="var(--color-line-strong)" />}
        {data.map((d, i) => (
          <g key={d.label}>
            {(i === hover || i === last) && <circle cx={x(i)} cy={y(d.value)} r={4.5} fill={color} stroke="var(--color-surface)" strokeWidth={2} />}
            <text x={x(i)} y={H - 8} textAnchor="middle" className="fill-ink-3 text-[11.5px]">
              {d.label}
            </text>
            <rect
              x={x(i) - plotW / Math.max(1, data.length - 1) / 2}
              y={pad.t}
              width={plotW / Math.max(1, data.length - 1)}
              height={plotH}
              fill="transparent"
              tabIndex={0}
              aria-label={`${d.label}: ${formatINR(d.value)}`}
              onMouseEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
            />
          </g>
        ))}
        {last >= 0 && hover === null && (
          <text x={x(last) - 8} y={y(data[last]!.value) - 12} textAnchor="end" className="fill-ink text-[12px] font-semibold tnum">
            {formatINRCompact(data[last]!.value)}
          </text>
        )}
      </svg>
      {hover !== null && data[hover] && (
        <div
          className="pointer-events-none absolute top-2 z-10 rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-[var(--shadow-raised)]"
          style={{ left: `${Math.min(80, Math.max(4, (x(hover) / W) * 100 - 8))}%` }}
        >
          <div className="font-semibold text-ink">{data[hover].label}</div>
          <div className="tnum text-ink-2">{formatINR(data[hover].value)}</div>
        </div>
      )}
    </div>
  );
}

/** Horizontal bars for ranked single-series values (e.g. service-wise revenue). */
export function HBarList({ data, color = "var(--chart-billed)", format = formatINR }: { data: { label: string; value: number; sub?: string }[]; color?: string; format?: (v: number) => string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <ul className="space-y-3">
      {data.map((d) => (
        <li key={d.label}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-[13px]">
            <span className="truncate text-ink-2">{d.label}</span>
            <span className="tnum shrink-0 font-medium text-ink">{format(d.value)}</span>
          </div>
          <div className="h-2 w-full rounded-full bg-subtle">
            <div className="h-2 rounded-full" style={{ width: `${(d.value / max) * 100}%`, background: color }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function Legend({ series }: { series: SeriesDef[] }) {
  if (series.length < 2) return null;
  return (
    <div className="mb-2 flex flex-wrap items-center gap-4 text-xs text-ink-2">
      {series.map((s) => (
        <span key={s.key} className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} aria-hidden />
          {s.label}
        </span>
      ))}
    </div>
  );
}
