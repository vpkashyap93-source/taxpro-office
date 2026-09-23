import Link from "next/link";
import { cn } from "@/lib/cn";

export interface TabItem {
  key: string;
  label: string;
  href: string;
  count?: number;
}

/** Link-based tabs: state lives in the URL, so tabs are shareable and work with back/forward. */
export function Tabs({ items, active, className }: { items: TabItem[]; active: string; className?: string }) {
  return (
    <nav aria-label="Sections" className={cn("scrollbar-thin -mx-4 overflow-x-auto px-4 md:mx-0 md:px-0", className)}>
      <ul className="flex min-w-max gap-1 border-b border-line">
        {items.map((t) => {
          const on = t.key === active;
          return (
            <li key={t.key}>
              <Link
                href={t.href}
                scroll={false}
                aria-current={on ? "page" : undefined}
                className={cn(
                  "relative inline-flex h-10 items-center gap-2 px-3 text-sm font-medium transition-colors",
                  on ? "text-navy-900" : "text-ink-3 hover:text-ink",
                )}
              >
                {t.label}
                {t.count !== undefined && (
                  <span className={cn("tnum rounded-full px-1.5 py-px text-[11px]", on ? "bg-navy-900 text-white" : "bg-line text-ink-2")}>{t.count}</span>
                )}
                {on && <span aria-hidden className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-navy-900" />}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
