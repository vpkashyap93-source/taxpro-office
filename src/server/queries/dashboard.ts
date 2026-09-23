import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { addDays, addMonths, diffDays, financialYearOf, fyRange, monthsBetween, startOfMonth, endOfMonth, todayISO } from "@/lib/dates";
import { percent } from "@/lib/format";
import type { AuthContext } from "../auth";
import { billingSummary, listInvoices, monthlySeries } from "./invoices";
import { calendarItems } from "./calendar";
import { isComplianceDone, listChecklists, listCompliance, listNotices, listTasks } from "./work";

export interface WorkItem {
  id: string;
  kind: "compliance" | "task";
  clientId: string | null;
  clientName: string | null;
  work: string;
  dueDate: string;
  priority: string;
  status: string;
  assigneeName: string | null;
  href: string;
}

export function openWork(firmId: string): WorkItem[] {
  const c = listCompliance(firmId)
    .filter((x) => !isComplianceDone(x.status))
    .map<WorkItem>((x) => ({ id: x.id, kind: "compliance", clientId: x.clientId, clientName: x.clientName, work: `${x.complianceType} · ${x.period}`, dueDate: x.dueDate, priority: x.priority, status: x.status, assigneeName: x.assigneeName, href: `/compliance?edit=${x.id}` }));
  const t = listTasks(firmId)
    .filter((x) => x.status !== "Completed")
    .map<WorkItem>((x) => ({ id: x.id, kind: "task", clientId: x.clientId, clientName: x.clientName, work: x.title, dueDate: x.dueDate, priority: x.priority, status: x.status, assigneeName: x.assigneeName, href: `/tasks?edit=${x.id}` }));
  const rank: Record<string, number> = { Critical: 0, High: 1, Medium: 2, Low: 3 };
  return [...c, ...t].sort((a, b) => a.dueDate.localeCompare(b.dueDate) || (rank[a.priority] ?? 9) - (rank[b.priority] ?? 9));
}

export function dashboardData(auth: AuthContext) {
  const firmId = auth.firm.id;
  const today = todayISO();
  const fy = financialYearOf(today);
  const { start: fyStart } = fyRange(fy);
  const finance = auth.can("billing") || auth.can("payments");

  const clientsAll = db.select({ status: s.clients.status }).from(s.clients).where(eq(s.clients.firmId, firmId)).all();
  const work = openWork(firmId);
  const todays = work.filter((w) => w.dueDate <= addDays(today, 1));
  const pendingNow = work.filter((w) => w.dueDate <= today);
  const upcoming7 = work.filter((w) => w.dueDate > today && w.dueDate <= addDays(today, 7));

  const checklists = listChecklists(firmId);
  const docsPending = checklists.reduce((a, c) => a + c.pending, 0);

  // Compliance progress for the current FY, per category.
  const fyCompliance = listCompliance(firmId, { financialYear: fy });
  const categories = ["GST", "ITR", "TDS", "CMA", "ROC", "Audit"] as const;
  const complianceProgress = categories
    .map((cat) => {
      // Denominator: work due by today, plus anything already finished early.
      const rows = fyCompliance.filter((c) => c.category === cat && (c.dueDate <= today || isComplianceDone(c.status)));
      const done = rows.filter((r) => isComplianceDone(r.status)).length;
      return { category: cat, total: rows.length, done, pct: percent(done, rows.length) };
    })
    .filter((r) => r.total > 0);

  // Finance
  const monthStart = startOfMonth(today);
  const summaryFY = finance ? billingSummary(firmId, fyStart, today, today) : null;
  const monthSummary = finance ? billingSummary(firmId, monthStart, endOfMonth(today), today) : null;
  const months = monthsBetween(addMonths(monthStart, -5), today);
  const series = finance ? monthlySeries(firmId, months) : [];
  const invoices = finance ? listInvoices(firmId, { today }) : [];
  const overdueBills = invoices
    .filter((i) => i.status === "Overdue")
    .sort((a, b) => b.outstanding - a.outstanding)
    .slice(0, 5)
    .map((i) => ({ ...i, days: diffDays(i.dueDate, today) }));
  const byClient = new Map<string, { id: string; name: string; billed: number; outstanding: number }>();
  for (const i of invoices.filter((i) => i.invoiceDate >= fyStart && i.storedStatus !== "Draft" && i.storedStatus !== "Cancelled")) {
    const e = byClient.get(i.clientId) ?? { id: i.clientId, name: i.clientName, billed: 0, outstanding: 0 };
    e.billed += i.total;
    e.outstanding += i.outstanding;
    byClient.set(i.clientId, e);
  }
  const topClients = [...byClient.values()].sort((a, b) => b.billed - a.billed).slice(0, 5);

  // Clients needing attention: overdue money, overdue work, pending docs, open notices.
  const attention = new Map<string, { id: string; name: string; reasons: string[]; score: number }>();
  const flag = (id: string | null, name: string | null, reason: string, score: number) => {
    if (!id || !name) return;
    const e = attention.get(id) ?? { id, name, reasons: [], score: 0 };
    if (!e.reasons.includes(reason)) e.reasons.push(reason);
    e.score += score;
    attention.set(id, e);
  };
  for (const w of work.filter((w) => w.dueDate < today)) flag(w.clientId, w.clientName, "Overdue work", 3);
  for (const b of invoices.filter((i) => i.status === "Overdue")) flag(b.clientId, b.clientName, "Overdue bill", 2);
  for (const c of checklists.filter((c) => c.pending > 0)) flag(c.clientId, c.clientName, "Documents pending", 1);
  for (const n of listNotices(firmId).filter((n) => n.status === "New" || n.status === "In Progress")) flag(n.clientId, n.clientName, "Open notice", 3);
  const needsAttention = [...attention.values()].sort((a, b) => b.score - a.score).slice(0, 8);

  const deadlines = calendarItems(firmId, today, addDays(today, 14), { includeFinance: false })
    .filter((i) => !i.done && i.category !== "Task" && i.category !== "Meeting")
    .slice(0, 7);

  // Team workload
  const staff = db.select({ id: s.users.id, name: s.users.name, role: s.users.role }).from(s.users).where(and(eq(s.users.firmId, firmId), eq(s.users.active, true))).all().filter((u) => u.role !== "Client");
  const team = staff
    .map((u) => {
      const mine = work.filter((w) => w.assigneeName === u.name);
      return { id: u.id, name: u.name, role: u.role, open: mine.length, overdue: mine.filter((w) => w.dueDate < today).length, today: mine.filter((w) => w.dueDate === today).length };
    })
    .sort((a, b) => b.open - a.open);

  return {
    today,
    fy,
    finance,
    kpis: {
      totalClients: clientsAll.length,
      activeClients: clientsAll.filter((c) => c.status === "Active").length,
      pendingWork: pendingNow.length,
      overdueWork: work.filter((w) => w.dueDate < today).length,
      unpaid: summaryFY?.outstanding ?? 0,
      unpaidCount: summaryFY?.unpaidCount ?? 0,
      monthCollection: monthSummary?.collected ?? 0,
      monthBilled: monthSummary?.generated ?? 0,
      docsPending,
      docsClients: new Set(checklists.filter((c) => c.pending > 0).map((c) => c.clientId)).size,
      upcoming7: upcoming7.length,
    },
    todays: todays.slice(0, 8),
    todaysTotal: todays.length,
    complianceProgress,
    summaryFY,
    series,
    overdueBills,
    pendingDocs: checklists.filter((c) => c.pending > 0).sort((a, b) => b.pending - a.pending).slice(0, 5),
    deadlines,
    topClients,
    needsAttention,
    team,
    paperless: paperlessMetrics(firmId),
  };
}

/** Paperless metrics computed from actual records (no fabricated environmental claims). */
export function paperlessMetrics(firmId: string) {
  const docs = db
    .select({ received: sql<number>`sum(case when ${s.documents.status} in ('Received','Partial') then 1 else 0 end)`, digital: sql<number>`sum(case when ${s.documents.storageKey} is not null then 1 else 0 end)` })
    .from(s.documents)
    .where(eq(s.documents.firmId, firmId))
    .get();
  const bills = db
    .select({ total: sql<number>`count(*)`, digital: sql<number>`sum(case when ${s.invoices.sentVia} is not null then 1 else 0 end)` })
    .from(s.invoices)
    .where(and(eq(s.invoices.firmId, firmId), sql`${s.invoices.status} not in ('Draft','Cancelled')`))
    .get();
  const reports =
    (db.select({ n: sql<number>`count(*)` }).from(s.cmaRecords).where(and(eq(s.cmaRecords.firmId, firmId), sql`${s.cmaRecords.reportGeneratedAt} is not null`)).get()?.n ?? 0) +
    (db.select({ n: sql<number>`count(*)` }).from(s.activityLogs).where(and(eq(s.activityLogs.firmId, firmId), eq(s.activityLogs.entityType, "report"))).get()?.n ?? 0);
  const digitalDocs = docs?.digital ?? 0;
  const digitalBills = bills?.digital ?? 0;
  return {
    digitalDocsPct: percent(digitalDocs, docs?.received ?? 0),
    digitalDocs,
    digitalBillsPct: percent(digitalBills, bills?.total ?? 0),
    digitalBills,
    reports,
    pagesSaved: digitalDocs + digitalBills + reports,
  };
}

export function monthRange(today = todayISO()) {
  return { from: startOfMonth(today), to: endOfMonth(today) };
}
