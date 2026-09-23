import "server-only";
import { listCma, listCompliance, listDsc, listEvents, listNotices, listTasks, isComplianceDone } from "./work";
import { listInvoices } from "./invoices";

export const CALENDAR_CATEGORIES = ["Compliance", "Bill Due", "Task", "Meeting", "CMA", "DSC Expiry", "Notice"] as const;
export type CalendarCategory = (typeof CALENDAR_CATEGORIES)[number];

export interface CalendarItem {
  id: string;
  date: string;
  time?: string | null;
  title: string;
  subtitle?: string | null;
  category: CalendarCategory;
  href: string;
  done?: boolean;
}

/** Aggregates every dated item across modules into one feed (nothing is duplicated into the events table). */
export function calendarItems(firmId: string, from: string, to: string, opts: { includeFinance: boolean }): CalendarItem[] {
  const items: CalendarItem[] = [];
  for (const c of listCompliance(firmId, { from, to })) {
    items.push({ id: `c-${c.id}`, date: c.dueDate, title: `${c.complianceType} · ${c.clientName}`, subtitle: `${c.period} · ${c.status}`, category: "Compliance", href: `/compliance?edit=${c.id}`, done: isComplianceDone(c.status) });
  }
  if (opts.includeFinance) {
    for (const i of listInvoices(firmId).filter((i) => i.dueDate >= from && i.dueDate <= to && i.outstanding > 0)) {
      items.push({ id: `i-${i.id}`, date: i.dueDate, title: `Bill due · ${i.clientName}`, subtitle: i.number, category: "Bill Due", href: `/billing/invoices/${i.id}` });
    }
  }
  for (const t of listTasks(firmId).filter((t) => t.dueDate >= from && t.dueDate <= to)) {
    items.push({ id: `t-${t.id}`, date: t.dueDate, title: t.title, subtitle: [t.clientName, t.assigneeName].filter(Boolean).join(" · "), category: "Task", href: `/tasks?edit=${t.id}`, done: t.status === "Completed" });
  }
  for (const e of listEvents(firmId, from, to)) {
    items.push({ id: `e-${e.id}`, date: e.date, time: e.startTime, title: e.title, subtitle: [e.clientName, e.location].filter(Boolean).join(" · "), category: "Meeting", href: `/calendar?event=${e.id}&date=${e.date}` });
  }
  for (const m of listCma(firmId).filter((m) => m.dueDate && m.dueDate >= from && m.dueDate <= to)) {
    items.push({ id: `m-${m.id}`, date: m.dueDate!, title: `CMA · ${m.clientName}`, subtitle: m.bank, category: "CMA", href: `/cma/${m.id}`, done: m.status === "Submitted" || m.status === "Final" });
  }
  for (const d of listDsc(firmId).filter((d) => d.expiryDate >= from && d.expiryDate <= to)) {
    items.push({ id: `d-${d.id}`, date: d.expiryDate, title: `DSC expiry · ${d.holderName}`, subtitle: d.clientName, category: "DSC Expiry", href: `/dsc?edit=${d.id}`, done: d.renewalStatus === "Renewed" });
  }
  for (const n of listNotices(firmId).filter((n) => n.dueDate && n.dueDate >= from && n.dueDate <= to)) {
    items.push({ id: `n-${n.id}`, date: n.dueDate!, title: `Notice reply · ${n.clientName}`, subtitle: n.noticeType, category: "Notice", href: `/notices?edit=${n.id}`, done: n.status === "Closed" || n.status === "Reply Submitted" });
  }
  return items.sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? "99").localeCompare(b.time ?? "99"));
}
