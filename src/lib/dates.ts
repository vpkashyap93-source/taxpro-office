/**
 * Date helpers. Calendar dates are ISO "YYYY-MM-DD" strings interpreted in India Standard Time.
 * We deliberately avoid Date arithmetic across time zones by working in UTC on date-only values.
 */

export const APP_TIME_ZONE = "Asia/Kolkata";

/** Today's date in IST as YYYY-MM-DD. */
export function todayISO(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  const d = parseISODate(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return toISODate(d);
}

/** Adds months keeping day-of-month clamped to the target month's length. */
export function addMonths(iso: string, months: number): string {
  const d = parseISODate(iso);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return toISODate(d);
}

export function diffDays(fromISO: string, toISO: string): number {
  return Math.round((parseISODate(toISO).getTime() - parseISODate(fromISO).getTime()) / 86_400_000);
}

export function startOfMonth(iso: string): string {
  return iso.slice(0, 8) + "01";
}

export function endOfMonth(iso: string): string {
  const d = parseISODate(startOfMonth(iso));
  return toISODate(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)));
}

/** "2026-09" → "Sep 2026" */
export function monthLabel(ym: string, style: "short" | "long" = "short"): string {
  const d = parseISODate(`${ym.slice(0, 7)}-01`);
  return new Intl.DateTimeFormat("en-IN", { month: style, year: "numeric", timeZone: "UTC" }).format(d);
}

export function shortMonth(ym: string): string {
  return new Intl.DateTimeFormat("en-IN", { month: "short", timeZone: "UTC" }).format(parseISODate(`${ym.slice(0, 7)}-01`));
}

/** "2026-09-20" → "20 Sep 2026" */
export function formatDate(iso: string | null | undefined, opts: { year?: boolean } = { year: true }): string {
  if (!iso) return "—";
  const d = parseISODate(iso.slice(0, 10));
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    ...(opts.year === false ? {} : { year: "numeric" }),
    timeZone: "UTC",
  }).format(d);
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: APP_TIME_ZONE,
  }).format(new Date(iso));
}

/** Human relative due label: "Today", "Tomorrow", "In 5 days", "3 days overdue". */
export function relativeDue(iso: string, today: string = todayISO()): string {
  const d = diffDays(today, iso);
  if (d === 0) return "Today";
  if (d === 1) return "Tomorrow";
  if (d === -1) return "Yesterday";
  if (d > 1) return d <= 30 ? `In ${d} days` : formatDate(iso);
  return `${-d} days overdue`;
}

/** Indian financial year (Apr–Mar) for a date: "2026-27". */
export function financialYearOf(iso: string): string {
  const [y, m] = iso.split("-").map(Number);
  const start = m >= 4 ? y : y - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

export function fyRange(fy: string): { start: string; end: string } {
  const start = Number(fy.slice(0, 4));
  return { start: `${start}-04-01`, end: `${start + 1}-03-31` };
}

/** List of "YYYY-MM" months from start to end inclusive. */
export function monthsBetween(startISO: string, endISO: string): string[] {
  const out: string[] = [];
  let cur = startOfMonth(startISO);
  while (cur <= endISO) {
    out.push(cur.slice(0, 7));
    cur = addMonths(cur, 1);
  }
  return out;
}

export function greeting(now: Date = new Date()): string {
  const h = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: APP_TIME_ZONE }).format(now));
  if (h < 12) return "Good Morning";
  if (h < 17) return "Good Afternoon";
  return "Good Evening";
}

export function longDate(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(parseISODate(iso));
}
