import "server-only";
import { and, asc, desc, eq, gte, lte, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { db, schema as s } from "@/db";

const assignee = alias(s.users, "assignee");

export function listCompliance(
  firmId: string,
  f: { clientId?: string; category?: string; from?: string; to?: string; financialYear?: string; assignedTo?: string } = {},
) {
  const where: SQL[] = [eq(s.complianceTasks.firmId, firmId)];
  if (f.clientId) where.push(eq(s.complianceTasks.clientId, f.clientId));
  if (f.category) where.push(eq(s.complianceTasks.category, f.category as (typeof s.COMPLIANCE_CATEGORIES)[number]));
  if (f.from) where.push(gte(s.complianceTasks.dueDate, f.from));
  if (f.to) where.push(lte(s.complianceTasks.dueDate, f.to));
  if (f.financialYear) where.push(eq(s.complianceTasks.financialYear, f.financialYear));
  if (f.assignedTo) where.push(eq(s.complianceTasks.assignedTo, f.assignedTo));
  return db
    .select({
      id: s.complianceTasks.id,
      clientId: s.complianceTasks.clientId,
      clientName: s.clients.name,
      category: s.complianceTasks.category,
      complianceType: s.complianceTasks.complianceType,
      period: s.complianceTasks.period,
      financialYear: s.complianceTasks.financialYear,
      dueDate: s.complianceTasks.dueDate,
      assignedTo: s.complianceTasks.assignedTo,
      assigneeName: assignee.name,
      priority: s.complianceTasks.priority,
      status: s.complianceTasks.status,
      filedDate: s.complianceTasks.filedDate,
      acknowledgement: s.complianceTasks.acknowledgement,
      notes: s.complianceTasks.notes,
    })
    .from(s.complianceTasks)
    .innerJoin(s.clients, eq(s.clients.id, s.complianceTasks.clientId))
    .leftJoin(assignee, eq(assignee.id, s.complianceTasks.assignedTo))
    .where(and(...where))
    .orderBy(asc(s.complianceTasks.dueDate), asc(s.clients.name))
    .all();
}
export type ComplianceRow = ReturnType<typeof listCompliance>[number];

export const isComplianceDone = (status: string) => status === "Completed" || status === "Filed";

export function listTasks(firmId: string, f: { clientId?: string; assignedTo?: string } = {}) {
  const where: SQL[] = [eq(s.tasks.firmId, firmId)];
  if (f.clientId) where.push(eq(s.tasks.clientId, f.clientId));
  if (f.assignedTo) where.push(eq(s.tasks.assignedTo, f.assignedTo));
  return db
    .select({
      id: s.tasks.id,
      title: s.tasks.title,
      clientId: s.tasks.clientId,
      clientName: s.clients.name,
      category: s.tasks.category,
      assignedTo: s.tasks.assignedTo,
      assigneeName: assignee.name,
      priority: s.tasks.priority,
      dueDate: s.tasks.dueDate,
      status: s.tasks.status,
      completedAt: s.tasks.completedAt,
      notes: s.tasks.notes,
    })
    .from(s.tasks)
    .leftJoin(s.clients, eq(s.clients.id, s.tasks.clientId))
    .leftJoin(assignee, eq(assignee.id, s.tasks.assignedTo))
    .where(and(...where))
    .orderBy(asc(s.tasks.dueDate))
    .all();
}
export type TaskRow = ReturnType<typeof listTasks>[number];

export function listChecklists(firmId: string, f: { clientId?: string } = {}) {
  const where: SQL[] = [eq(s.documentChecklists.firmId, firmId)];
  if (f.clientId) where.push(eq(s.documentChecklists.clientId, f.clientId));
  const lists = db
    .select({ checklist: s.documentChecklists, clientName: s.clients.name, clientMobile: s.clients.mobile, clientEmail: s.clients.email })
    .from(s.documentChecklists)
    .innerJoin(s.clients, eq(s.clients.id, s.documentChecklists.clientId))
    .where(and(...where))
    .orderBy(desc(s.documentChecklists.createdAt), asc(s.clients.name))
    .all();
  const docs = db
    .select()
    .from(s.documents)
    .where(f.clientId ? and(eq(s.documents.firmId, firmId), eq(s.documents.clientId, f.clientId)) : eq(s.documents.firmId, firmId))
    .orderBy(asc(s.documents.createdAt))
    .all();
  return lists.map((l) => {
    const items = docs.filter((d) => d.checklistId === l.checklist.id);
    const pending = items.filter((d) => d.status === "Pending" || d.status === "Partial").length;
    return { ...l.checklist, clientName: l.clientName, clientMobile: l.clientMobile, clientEmail: l.clientEmail, items, pending };
  });
}
export type ChecklistRow = ReturnType<typeof listChecklists>[number];

export function listCma(firmId: string, f: { clientId?: string } = {}) {
  const where: SQL[] = [eq(s.cmaRecords.firmId, firmId)];
  if (f.clientId) where.push(eq(s.cmaRecords.clientId, f.clientId));
  return db
    .select({ cma: s.cmaRecords, clientName: s.clients.name, assigneeName: assignee.name })
    .from(s.cmaRecords)
    .innerJoin(s.clients, eq(s.clients.id, s.cmaRecords.clientId))
    .leftJoin(assignee, eq(assignee.id, s.cmaRecords.assignedTo))
    .where(and(...where))
    .orderBy(desc(s.cmaRecords.updatedAt))
    .all()
    .map((r) => ({ ...r.cma, clientName: r.clientName, assigneeName: r.assigneeName }));
}

export function listNotices(firmId: string, f: { clientId?: string } = {}) {
  const where: SQL[] = [eq(s.notices.firmId, firmId)];
  if (f.clientId) where.push(eq(s.notices.clientId, f.clientId));
  return db
    .select({ n: s.notices, clientName: s.clients.name, assigneeName: assignee.name })
    .from(s.notices)
    .innerJoin(s.clients, eq(s.clients.id, s.notices.clientId))
    .leftJoin(assignee, eq(assignee.id, s.notices.assignedTo))
    .where(and(...where))
    .orderBy(asc(s.notices.dueDate))
    .all()
    .map((r) => ({ ...r.n, clientName: r.clientName, assigneeName: r.assigneeName }));
}

export function listDsc(firmId: string, f: { clientId?: string } = {}) {
  const where: SQL[] = [eq(s.dscRecords.firmId, firmId)];
  if (f.clientId) where.push(eq(s.dscRecords.clientId, f.clientId));
  return db
    .select({ d: s.dscRecords, clientName: s.clients.name })
    .from(s.dscRecords)
    .innerJoin(s.clients, eq(s.clients.id, s.dscRecords.clientId))
    .where(and(...where))
    .orderBy(asc(s.dscRecords.expiryDate))
    .all()
    .map((r) => ({ ...r.d, clientName: r.clientName }));
}

export function listEvents(firmId: string, from: string, to: string) {
  return db
    .select({ e: s.calendarEvents, clientName: s.clients.name })
    .from(s.calendarEvents)
    .leftJoin(s.clients, eq(s.clients.id, s.calendarEvents.clientId))
    .where(and(eq(s.calendarEvents.firmId, firmId), gte(s.calendarEvents.date, from), lte(s.calendarEvents.date, to)))
    .orderBy(asc(s.calendarEvents.date), asc(s.calendarEvents.startTime))
    .all()
    .map((r) => ({ ...r.e, clientName: r.clientName }));
}
