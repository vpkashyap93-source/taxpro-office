import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type Tone = "neutral" | "ok" | "warn" | "danger" | "info" | "review" | "gold" | "navy";

const tones: Record<Tone, string> = {
  neutral: "bg-subtle text-ink-2 ring-line-strong",
  ok: "bg-ok-bg text-ok ring-ok-line",
  warn: "bg-warn-bg text-warn ring-warn-line",
  danger: "bg-danger-bg text-danger ring-danger-line",
  info: "bg-info-bg text-info ring-info-line",
  review: "bg-review-bg text-review ring-review-line",
  gold: "bg-gold-50 text-gold ring-gold-100",
  navy: "bg-navy-900 text-white ring-navy-900",
};

const dots: Record<Tone, string> = {
  neutral: "bg-ink-4",
  ok: "bg-ok",
  warn: "bg-warn",
  danger: "bg-danger",
  info: "bg-info",
  review: "bg-review",
  gold: "bg-gold",
  navy: "bg-white",
};

export function Badge({ tone = "neutral", dot, children, className }: { tone?: Tone; dot?: boolean; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-xs font-medium ring-1 ring-inset", tones[tone], className)}>
      {dot && <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", dots[tone])} />}
      {children}
    </span>
  );
}
