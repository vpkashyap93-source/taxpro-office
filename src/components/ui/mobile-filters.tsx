"use client";

import { SlidersHorizontal } from "lucide-react";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Many filters take a whole screen on a phone. Below `md` they collapse behind a
 * "Filters" button (showing how many are active); on larger screens they render inline.
 */
export function MobileFilters({ children, active = 0, className }: { children: ReactNode; active?: number; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={cn("md:contents", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={cn(
          "inline-flex h-9.5 shrink-0 items-center gap-2 rounded-lg border px-3 text-sm font-medium md:hidden",
          active ? "border-navy-900 bg-navy-50 text-navy-900" : "border-line-strong bg-surface text-ink-2",
        )}
      >
        <SlidersHorizontal className="h-4 w-4" />
        Filters{active ? ` · ${active}` : ""}
      </button>
      <div className={cn("mt-2 w-full grid-cols-2 gap-2 md:mt-0 md:flex md:w-auto md:flex-wrap md:items-center [&_select]:w-full md:[&_select]:w-auto [&_input]:w-full md:[&_input]:w-auto", open ? "grid" : "hidden")}>
        {children}
      </div>
    </div>
  );
}
