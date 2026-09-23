"use client";

import Link from "next/link";
import { MoreHorizontal } from "lucide-react";
import { Popover } from "@/components/layout/popover";

export interface RowAction {
  label: string;
  href: string;
  external?: boolean;
}

/** Compact per-row action menu used in tracker tables. */
export function RowActions({ actions, label = "Actions" }: { actions: RowAction[]; label?: string }) {
  return (
    <Popover
      label={label}
      className="w-48 py-1.5"
      trigger={({ toggle, open }) => (
        <button type="button" onClick={toggle} aria-expanded={open} aria-label={label} className="rounded-lg p-1.5 text-ink-3 hover:bg-subtle hover:text-ink">
          <MoreHorizontal className="h-4.5 w-4.5" />
        </button>
      )}
    >
      {(close) => (
        <ul>
          {actions.map((a) => (
            <li key={a.label}>
              {a.external ? (
                <a href={a.href} target="_blank" rel="noopener noreferrer" onClick={close} className="block px-3.5 py-2 text-sm text-ink-2 hover:bg-subtle">
                  {a.label}
                </a>
              ) : (
                <Link href={a.href} onClick={close} className="block px-3.5 py-2 text-sm text-ink-2 hover:bg-subtle">
                  {a.label}
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </Popover>
  );
}
