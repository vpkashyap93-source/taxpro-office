import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Accent = "navy" | "brand" | "warn" | "danger" | "gold" | "info";

const accents: Record<Accent, string> = {
  navy: "bg-navy-50 text-navy-700",
  brand: "bg-brand-50 text-brand",
  warn: "bg-warn-bg text-warn",
  danger: "bg-danger-bg text-danger",
  gold: "bg-gold-50 text-gold",
  info: "bg-info-bg text-info",
};

export function KpiCard({ href, label, value, caption, icon, accent = "navy" }: { href: string; label: string; value: ReactNode; caption?: ReactNode; icon: ReactNode; accent?: Accent }) {
  return (
    <Link
      href={href}
      className="group relative flex min-w-0 flex-col rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-[var(--shadow-card)] transition-all hover:-translate-y-0.5 hover:border-line-strong hover:shadow-[var(--shadow-raised)] sm:p-5"
    >
      <div className="flex items-start justify-between">
        <span className={cn("flex h-9 w-9 items-center justify-center rounded-xl", accents[accent])}>{icon}</span>
        <ArrowUpRight className="h-4 w-4 text-ink-4 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
      </div>
      <p className="mt-3.5 text-[12.5px] font-medium text-ink-3">{label}</p>
      <p className="tnum mt-0.5 text-xl font-semibold tracking-[-0.02em] [overflow-wrap:anywhere] text-ink min-[400px]:text-[22px] sm:text-[26px]">{value}</p>
      {caption && <p className="mt-1 truncate text-xs text-ink-3">{caption}</p>}
    </Link>
  );
}
