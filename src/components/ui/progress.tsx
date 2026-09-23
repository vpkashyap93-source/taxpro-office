import { cn } from "@/lib/cn";

export function ProgressBar({ value, tone = "brand", className, label }: { value: number; tone?: "brand" | "navy" | "warn" | "danger" | "gold"; className?: string; label?: string }) {
  const v = Math.max(0, Math.min(100, value));
  const color = { brand: "bg-brand-500", navy: "bg-navy-600", warn: "bg-warn", danger: "bg-danger", gold: "bg-gold-400" }[tone];
  return (
    <div role="progressbar" aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100} aria-label={label} className={cn("h-2 w-full overflow-hidden rounded-full bg-line", className)}>
      <div className={cn("h-full rounded-full transition-[width] duration-500", color)} style={{ width: `${v}%` }} />
    </div>
  );
}

/** Circular meter used for eco/paperless metrics. */
export function RingMeter({ value, size = 64, label }: { value: number; size?: number; label: string }) {
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, value));
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${label}: ${Math.round(v)}%`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-brand-100)" strokeWidth={6} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--color-brand)"
        strokeWidth={6}
        strokeLinecap="round"
        strokeDasharray={`${(v / 100) * c} ${c}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" className="fill-ink text-[13px] font-semibold tnum">
        {Math.round(v)}%
      </text>
    </svg>
  );
}
