import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface Column<T> {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  align?: "left" | "right" | "center";
  className?: string;
  /** Hide below this breakpoint in table mode. */
  hideBelow?: "lg" | "xl" | "2xl";
}

/**
 * Data table with a purpose-built mobile layout: rows become cards below `md`
 * (via the `mobileCard` renderer) instead of a squeezed horizontal table.
 */
export function DataTable<T>({
  rows,
  columns,
  rowKey,
  mobileCard,
  empty,
  caption,
  className,
  dense,
  rowClassName,
}: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  mobileCard?: (row: T) => ReactNode;
  empty?: ReactNode;
  caption?: string;
  className?: string;
  dense?: boolean;
  rowClassName?: (row: T) => string | undefined;
}) {
  if (rows.length === 0 && empty) return <>{empty}</>;
  const hide = (c: Column<T>) => (c.hideBelow === "lg" ? "hidden lg:table-cell" : c.hideBelow === "xl" ? "hidden xl:table-cell" : c.hideBelow === "2xl" ? "hidden 2xl:table-cell" : "");
  const align = (c: Column<T>) => (c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : "text-left");
  return (
    <div className={className}>
      <div className={cn("scrollbar-thin overflow-x-auto", mobileCard && "hidden md:block")}>
        <table className="w-full border-collapse text-sm">
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead>
            <tr className="border-y border-line bg-subtle">
              {columns.map((c) => (
                <th key={c.key} scope="col" className={cn("px-4 py-2.5 text-[11.5px] font-semibold uppercase tracking-[0.06em] whitespace-nowrap text-ink-3 first:ps-5 last:pe-5", align(c), hide(c), c.className)}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={rowKey(r)} className={cn("border-b border-line last:border-b-0 transition-colors hover:bg-navy-50/50", rowClassName?.(r))}>
                {columns.map((c) => (
                  <td key={c.key} className={cn("px-4 align-middle first:ps-5 last:pe-5", dense ? "py-2" : "py-3", align(c), hide(c), c.className)}>
                    {c.cell(r)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {mobileCard && (
        <ul className="divide-y divide-line border-t border-line md:hidden">
          {rows.map((r) => (
            <li key={rowKey(r)} className="px-4 py-3.5">
              {mobileCard(r)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
