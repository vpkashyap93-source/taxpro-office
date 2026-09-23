import Link from "next/link";
import { cn } from "@/lib/cn";

export interface Chip {
  key: string;
  label: string;
  href: string;
  count?: number;
}

export function FilterChips({ chips, active, label = "Filter" }: { chips: Chip[]; active: string; label?: string }) {
  return (
    <nav aria-label={label} className="scrollbar-thin -mx-1 overflow-x-auto px-1">
      <ul className="flex min-w-max gap-1.5">
        {chips.map((c) => {
          const on = c.key === active;
          return (
            <li key={c.key}>
              <Link
                href={c.href}
                scroll={false}
                aria-current={on ? "true" : undefined}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium transition-colors",
                  on ? "border-navy-900 bg-navy-900 text-white" : "border-line-strong bg-surface text-ink-2 hover:border-ink-4 hover:text-ink",
                )}
              >
                {c.label}
                {c.count !== undefined && <span className={cn("tnum text-[11px]", on ? "text-white/70" : "text-ink-4")}>{c.count}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Builds a URL preserving existing search params while overriding some. */
export function withParams(base: string, current: Record<string, string | undefined>, patch: Record<string, string | undefined>) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...current, ...patch })) if (v) p.set(k, v);
  const q = p.toString();
  return q ? `${base}?${q}` : base;
}
