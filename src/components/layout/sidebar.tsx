"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Leaf } from "lucide-react";
import { cn } from "@/lib/cn";
import { LogoMark, Wordmark } from "./logo";
import { NAV_GROUPS, NAV_ITEMS } from "./nav";

export const TAGLINE = "Organised Practice • Happier Clients • A Greener Tomorrow";

export function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function NavList({ allowed, onNavigate }: { allowed: string[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="space-y-5">
      {NAV_GROUPS.map((g) => {
        const items = NAV_ITEMS.filter((i) => g.items.includes(i.href) && allowed.includes(i.href));
        if (!items.length) return null;
        return (
          <div key={g.label}>
            <p className="mb-1.5 px-3 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-white/35">{g.label}</p>
            <ul className="space-y-0.5">
              {items.map((item) => {
                const on = isActive(pathname, item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={on ? "page" : undefined}
                      className={cn(
                        "group relative flex h-9 items-center gap-3 rounded-lg px-3 text-[13.5px] font-medium transition-colors",
                        on ? "bg-white/[0.09] text-white" : "text-white/65 hover:bg-white/[0.05] hover:text-white",
                      )}
                    >
                      {on && <span aria-hidden className="absolute inset-y-2 -left-3 w-[3px] rounded-r-full bg-gold-400" />}
                      <item.icon className={cn("h-[17px] w-[17px] shrink-0", on ? "text-gold-400" : "text-white/50 group-hover:text-white/80")} strokeWidth={1.9} />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

export function Sidebar({ allowed, firmName }: { allowed: string[]; firmName: string }) {
  return (
    <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-[260px] flex-col bg-navy-950 lg:flex">
      <div className="px-5 pt-5 pb-4">
        <Link href="/dashboard" className="flex items-center gap-3" aria-label="TaxPro Office home">
          <LogoMark />
          <Wordmark />
        </Link>
        <p className="mt-3 text-[11px] leading-relaxed text-white/45">{TAGLINE}</p>
      </div>
      <div className="mx-5 mb-3 rounded-lg border border-white/[0.07] bg-white/[0.03] px-3 py-2">
        <p className="text-[10.5px] uppercase tracking-[0.1em] text-white/35">Firm</p>
        <p className="truncate text-[13px] font-medium text-white/85">{firmName}</p>
      </div>
      <div className="scrollbar-thin flex-1 overflow-y-auto px-3 pb-4">
        <NavList allowed={allowed} />
      </div>
      <div className="m-3 rounded-xl border border-brand/30 bg-brand/10 p-3">
        <p className="flex items-center gap-2 text-[12.5px] font-semibold text-emerald-200">
          <Leaf className="h-4 w-4" /> Paperless Practice
        </p>
        <p className="mt-1 text-[11.5px] leading-relaxed text-white/55">Bills, documents and reports stay digital — share instead of print.</p>
      </div>
    </aside>
  );
}
