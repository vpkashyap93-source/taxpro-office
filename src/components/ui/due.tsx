import { cn } from "@/lib/cn";
import { diffDays, formatDate, relativeDue, todayISO } from "@/lib/dates";

/** Relative due date with urgency colour: overdue (red), today (amber), soon (ink), later (muted). */
export function DueLabel({ date, done, today = todayISO(), showDate }: { date: string | null | undefined; done?: boolean; today?: string; showDate?: boolean }) {
  if (!date) return <span className="text-ink-4">—</span>;
  const d = diffDays(today, date);
  const tone = done ? "text-ink-3" : d < 0 ? "text-danger font-medium" : d === 0 ? "text-warn font-medium" : d <= 3 ? "text-ink" : "text-ink-2";
  return (
    <span className={cn("tnum whitespace-nowrap", tone)} title={formatDate(date)}>
      {done ? formatDate(date) : relativeDue(date, today)}
      {showDate && !done && Math.abs(d) <= 30 && <span className="ms-1.5 text-xs font-normal text-ink-4">{formatDate(date, { year: false })}</span>}
    </span>
  );
}
