"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { cn } from "@/lib/cn";
import { inputClass, Select } from "./form";

function useSetParam() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const set = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams(params.toString());
    p.delete("page"); // any filter change returns to the first page
    for (const [k, v] of Object.entries(patch)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    const q = p.toString();
    start(() => router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false }));
  };
  return { set, params, pending };
}

/** Debounced search box bound to a URL search param. */
export function SearchBox({ param = "q", placeholder, className }: { param?: string; placeholder: string; className?: string }) {
  const { set, params, pending } = useSetParam();
  const [value, setValue] = useState(params.get(param) ?? "");
  useEffect(() => {
    const current = params.get(param) ?? "";
    if (value === current) return;
    const t = setTimeout(() => set({ [param]: value.trim() || null }), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-4" aria-hidden />
      <input type="search" aria-label={placeholder} placeholder={placeholder} value={value} onChange={(e) => setValue(e.target.value)} className={cn(inputClass, "ps-9 pe-8")} aria-busy={pending} />
      {value && (
        <button type="button" onClick={() => setValue("")} className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-ink-4 hover:text-ink" aria-label="Clear search">
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

export function SelectFilter({ param, options, placeholder, label, className }: { param: string; options: readonly (string | { value: string; label: string })[]; placeholder: string; label: string; className?: string }) {
  const { set, params } = useSetParam();
  return (
    <Select aria-label={label} className={cn("w-auto min-w-40", className)} value={params.get(param) ?? ""} onChange={(e) => set({ [param]: e.target.value || null })} options={options} placeholder={placeholder} />
  );
}

export function DateFilter({ param, label }: { param: string; label: string }) {
  const { set, params } = useSetParam();
  return <input type="date" aria-label={label} title={label} className={cn(inputClass, "tnum w-auto")} value={params.get(param) ?? ""} onChange={(e) => set({ [param]: e.target.value || null })} />;
}
