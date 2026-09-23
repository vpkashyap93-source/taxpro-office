"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import type { ActionResult } from "@/lib/action-types";
import { cn } from "@/lib/cn";
import { useToast } from "./toast";
import { statusTone } from "./status-badge";

const toneCls: Record<string, string> = {
  neutral: "bg-subtle text-ink-2 ring-line-strong",
  ok: "bg-ok-bg text-ok ring-ok-line",
  warn: "bg-warn-bg text-warn ring-warn-line",
  danger: "bg-danger-bg text-danger ring-danger-line",
  info: "bg-info-bg text-info ring-info-line",
  review: "bg-review-bg text-review ring-review-line",
  gold: "bg-gold-50 text-gold ring-gold-100",
};

/** Status badge that doubles as a quick-change select (saves immediately). */
export function InlineStatus({ id, status, options, action, label, disabled }: { id: string; status: string; options: readonly string[]; action: (id: string, status: string) => Promise<ActionResult>; label: string; disabled?: boolean }) {
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  return (
    <select
      aria-label={label}
      value={status}
      disabled={disabled || pending}
      onChange={(e) => {
        const next = e.target.value;
        start(async () => {
          const r = await action(id, next);
          toast(r.ok ? (r.message ?? "Updated") : r.error, r.ok ? "success" : "error");
          router.refresh();
        });
      }}
      className={cn(
        "h-6.5 w-auto max-w-44 cursor-pointer appearance-none rounded-full border-0 ps-2.5 pe-6 text-xs font-medium ring-1 ring-inset focus:ring-2 focus:ring-navy-600 focus:outline-none disabled:cursor-default",
        "bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2210%22 height=%2210%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%236f7c8f%22 stroke-width=%223%22><path d=%22m6 9 6 6 6-6%22/></svg>')] bg-[length:10px] bg-[right_8px_center] bg-no-repeat",
        toneCls[statusTone(status)],
        pending && "opacity-60",
      )}
    >
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}
