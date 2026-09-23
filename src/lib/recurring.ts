/** Pure recurring-billing rules. */
import { addDays, addMonths, endOfMonth, monthLabel } from "./dates";

export type Frequency = "Monthly" | "Quarterly" | "Yearly" | "Custom";

export function intervalFor(frequency: Frequency, customMonths?: number): number {
  switch (frequency) {
    case "Monthly":
      return 1;
    case "Quarterly":
      return 3;
    case "Yearly":
      return 12;
    case "Custom":
      return Math.min(24, Math.max(1, Math.round(customMonths ?? 1)));
  }
}

/** Period key stored on the invoice for duplicate protection, e.g. "2026-09" or "2026-07..2026-09". */
export function periodKey(periodStart: string, intervalMonths: number): string {
  const start = periodStart.slice(0, 7);
  if (intervalMonths === 1) return start;
  const end = addMonths(periodStart, intervalMonths - 1).slice(0, 7);
  return `${start}..${end}`;
}

export function periodLabel(periodStart: string, intervalMonths: number): string {
  if (intervalMonths === 1) return monthLabel(periodStart, "long");
  const end = addMonths(periodStart, intervalMonths - 1);
  return `${monthLabel(periodStart)} – ${monthLabel(end)}`;
}

export function periodKeyLabel(key: string | null | undefined): string {
  if (!key) return "—";
  if (/^\d{4}-\d{2}$/.test(key)) return monthLabel(key);
  const m = key.match(/^(\d{4}-\d{2})\.\.(\d{4}-\d{2})$/);
  if (m) return `${monthLabel(m[1])} – ${monthLabel(m[2])}`;
  return key;
}

export interface DuePeriod {
  periodStart: string;
  key: string;
  label: string;
}

/**
 * All periods of a plan that are due for billing up to and including `uptoMonth` (YYYY-MM).
 * A plan's period is billable once the period has started. Capped to avoid runaway generation.
 */
export function duePeriods(nextPeriodStart: string, intervalMonths: number, uptoMonth: string, cap = 12): DuePeriod[] {
  const limit = endOfMonth(`${uptoMonth}-01`);
  const out: DuePeriod[] = [];
  let cur = nextPeriodStart;
  while (cur <= limit && out.length < cap) {
    out.push({ periodStart: cur, key: periodKey(cur, intervalMonths), label: periodLabel(cur, intervalMonths) });
    cur = addMonths(cur, intervalMonths);
  }
  return out;
}

export function dueDateFor(invoiceDate: string, dueDays: number): string {
  return addDays(invoiceDate, dueDays);
}
