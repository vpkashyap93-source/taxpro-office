import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Card({ className, children, as: Tag = "section" }: { className?: string; children: ReactNode; as?: "section" | "div" | "article" }) {
  return <Tag className={cn("min-w-0 rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--shadow-card)]", className)}>{children}</Tag>;
}

export function CardHeader({
  title,
  subtitle,
  action,
  icon,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex items-start justify-between gap-3 px-5 pt-4.5 pb-3", className)}>
      <div className="flex min-w-0 items-start gap-3">
        {icon && <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-navy-50 text-navy-700">{icon}</span>}
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-ink">{title}</h2>
          {subtitle && <p className="mt-0.5 text-[13px] text-ink-3">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </header>
  );
}

export function CardBody({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("px-5 pb-5", className)}>{children}</div>;
}

export function CardFooter({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("border-t border-line px-5 py-3", className)}>{children}</div>;
}
