import { AlertTriangle, Inbox } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function EmptyState({ icon, title, description, action, className }: { icon?: ReactNode; title: string; description?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-12 text-center", className)}>
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-navy-50 text-navy-700">{icon ?? <Inbox className="h-5.5 w-5.5" />}</div>
      <p className="text-sm font-semibold text-ink">{title}</p>
      {description && <p className="mt-1 max-w-sm text-[13px] text-ink-3">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ title = "Something went wrong", description, action }: { title?: string; description?: ReactNode; action?: ReactNode }) {
  return (
    <div role="alert" className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-danger-bg text-danger">
        <AlertTriangle className="h-5.5 w-5.5" />
      </div>
      <p className="text-sm font-semibold text-ink">{title}</p>
      {description && <p className="mt-1 max-w-md text-[13px] text-ink-3">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-line/70", className)} />;
}

export function LoadingState({ rows = 5, label = "Loading…" }: { rows?: number; label?: string }) {
  return (
    <div role="status" aria-live="polite" className="space-y-3 p-5">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div role="status" aria-live="polite" className="space-y-6">
      <span className="sr-only">Loading page…</span>
      <div className="space-y-2">
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-4 w-80" />
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-[var(--radius-card)]" />
        ))}
      </div>
      <Skeleton className="h-80 rounded-[var(--radius-card)]" />
    </div>
  );
}
