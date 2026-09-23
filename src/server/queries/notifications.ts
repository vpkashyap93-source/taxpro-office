import "server-only";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { addDays, diffDays, formatDate, todayISO } from "@/lib/dates";
import { formatINR } from "@/lib/money";
import type { AuthContext } from "../auth";
import { listInvoices } from "./invoices";
import { isComplianceDone, listChecklists, listCma, listCompliance, listDsc, listNotices } from "./work";

/**
 * Derives time-based notifications (due tomorrow, overdue, expiring) for the signed-in user.
 * Idempotent through a per-user dedupe key, so it is safe to run on every page load.
 */
export function syncNotifications(auth: AuthContext) {
  const firmId = auth.firm.id;
  const me = auth.user.id;
  const today = todayISO();
  const rows: (typeof s.notifications.$inferInsert)[] = [];
  const add = (kind: string, key: string, title: string, body: string, href: string) =>
    rows.push({ firmId, userId: me, kind, title, body, href, dedupeKey: key });

  const isLead = auth.user.role === "Admin" || auth.user.role === "Senior";
  if (auth.can("compliance")) {
    for (const c of listCompliance(firmId, { from: addDays(today, -3), to: addDays(today, 1) })) {
      if (isComplianceDone(c.status) || (!isLead && c.assignedTo !== me)) continue;
      const d = diffDays(today, c.dueDate);
      if (d === 1) add("compliance", `due1:${c.id}`, `${c.complianceType} due tomorrow`, `${c.clientName} · ${c.period}`, `/compliance?edit=${c.id}`);
      if (d === 0) add("compliance", `due0:${c.id}`, `${c.complianceType} due today`, `${c.clientName} · ${c.period}`, `/compliance?edit=${c.id}`);
    }
  }
  if (auth.can("billing")) {
    for (const i of listInvoices(firmId, { today }).filter((i) => i.status === "Overdue").slice(0, 15)) {
      add("invoice", `overdue:${i.id}`, "Invoice overdue", `${i.number} · ${i.clientName} · ${formatINR(i.outstanding)} outstanding`, `/billing/invoices/${i.id}`);
    }
  }
  if (auth.can("documents")) {
    for (const c of listChecklists(firmId).filter((c) => c.pending > 0 && c.dueDate && c.dueDate < today)) {
      add("document", `docs:${c.id}`, "Documents pending", `${c.clientName} · ${c.title} — ${c.pending} pending`, `/documents?checklist=${c.id}`);
    }
  }
  if (auth.can("dsc")) {
    for (const d of listDsc(firmId).filter((d) => d.renewalStatus !== "Renewed")) {
      const left = diffDays(today, d.expiryDate);
      if (left >= 0 && left <= 15) add("dsc", `dsc15:${d.id}`, `DSC expires in ${left} day${left === 1 ? "" : "s"}`, `${d.holderName} · ${d.clientName}`, `/dsc?edit=${d.id}`);
    }
  }
  if (auth.can("cma")) {
    for (const m of listCma(firmId).filter((m) => m.dueDate && m.status !== "Submitted" && m.status !== "Final")) {
      const left = diffDays(today, m.dueDate!);
      if (left >= 0 && left <= 3) add("cma", `cma:${m.id}:${m.dueDate}`, "CMA deadline approaching", `${m.clientName} · due ${formatDate(m.dueDate)}`, `/cma/${m.id}`);
    }
  }
  if (auth.can("notices")) {
    for (const n of listNotices(firmId).filter((n) => n.dueDate && n.status !== "Closed" && n.status !== "Reply Submitted")) {
      const left = diffDays(today, n.dueDate!);
      if (left <= 5) add("notice", `notice:${n.id}:${n.dueDate}`, left < 0 ? "Notice reply overdue" : "Notice reply due soon", `${n.clientName} · ${n.noticeType}`, `/notices?edit=${n.id}`);
    }
  }
  if (rows.length) db.insert(s.notifications).values(rows).onConflictDoNothing().run();
}

export function listNotifications(userId: string, limit = 30) {
  return db.select().from(s.notifications).where(eq(s.notifications.userId, userId)).orderBy(desc(s.notifications.createdAt)).limit(limit).all();
}

export function unreadCount(userId: string) {
  return db.select({ n: sql<number>`count(*)` }).from(s.notifications).where(and(eq(s.notifications.userId, userId), isNull(s.notifications.readAt))).get()?.n ?? 0;
}
