import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";

export const PAGE_SIZE = 25;

export function paginate<T>(rows: T[], pageParam: string | undefined, size = PAGE_SIZE) {
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const page = Math.min(pages, Math.max(1, Number(pageParam) || 1));
  return { page, pages, slice: rows.slice((page - 1) * size, page * size), from: rows.length ? (page - 1) * size + 1 : 0, to: Math.min(rows.length, page * size), total: rows.length };
}

/** URL-based pagination footer. `href(page)` builds the link for a page number. */
export function Pagination({ page, pages, from, to, total, href, noun = "records" }: { page: number; pages: number; from: number; to: number; total: number; href: (p: number) => string; noun?: string }) {
  if (total === 0) return null;
  const btn = "inline-flex h-8 min-w-8 items-center justify-center rounded-lg border px-2 text-[13px] font-medium";
  const nums = Array.from({ length: pages }, (_, i) => i + 1).filter((p) => p === 1 || p === pages || Math.abs(p - page) <= 1);
  return (
    <nav aria-label="Pagination" className="flex flex-col items-center justify-between gap-3 border-t border-line px-5 py-3 sm:flex-row">
      <p className="text-xs text-ink-3">
        Showing <span className="tnum font-medium text-ink-2">{from}–{to}</span> of <span className="tnum font-medium text-ink-2">{total}</span> {noun}
      </p>
      {pages > 1 && (
        <ul className="flex items-center gap-1">
          <li>
            {page > 1 ? (
              <Link href={href(page - 1)} scroll={false} className={cn(btn, "border-line-strong text-ink-2 hover:bg-subtle")} aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></Link>
            ) : (
              <span className={cn(btn, "border-line text-ink-4")} aria-hidden><ChevronLeft className="h-4 w-4" /></span>
            )}
          </li>
          {nums.map((p, i) => (
            <li key={p} className="flex items-center gap-1">
              {i > 0 && p - nums[i - 1]! > 1 && <span className="px-1 text-ink-4">…</span>}
              <Link href={href(p)} scroll={false} aria-current={p === page ? "page" : undefined} className={cn(btn, p === page ? "border-navy-900 bg-navy-900 text-white" : "border-line-strong text-ink-2 hover:bg-subtle")}>
                {p}
              </Link>
            </li>
          ))}
          <li>
            {page < pages ? (
              <Link href={href(page + 1)} scroll={false} className={cn(btn, "border-line-strong text-ink-2 hover:bg-subtle")} aria-label="Next page"><ChevronRight className="h-4 w-4" /></Link>
            ) : (
              <span className={cn(btn, "border-line text-ink-4")} aria-hidden><ChevronRight className="h-4 w-4" /></span>
            )}
          </li>
        </ul>
      )}
    </nav>
  );
}
