"use server";

import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db, schema as s } from "@/db";
import type { ActionResult } from "@/lib/action-types";
import { todayISO } from "@/lib/dates";
import { complianceSchema, eventSchema, taskSchema } from "@/lib/validation";
import { COMPLIANCE_STATUSES, TASK_STATUSES } from "@/db/schema";
import { authorize } from "../auth";
import { formToObject, runAction, UserError } from "../action";
import { audit, logActivity, notify, touched } from "../activity";

function ownClient(firmId: string, clientId: string | undefined | null) {
  if (!clientId) return null;
  const c = db.select({ id: s.clients.id, name: s.clients.name }).from(s.clients).where(and(eq(s.clients.id, clientId), eq(s.clients.firmId, firmId))).get();
  if (!c) throw new UserError("Client not found.");
  return c;
}

function ownStaff(firmId: string, userId: string | undefined | null) {
  if (!userId) return null;
  const u = db.select({ id: s.users.id, name: s.users.name }).from(s.users).where(and(eq(s.users.id, userId), eq(s.users.firmId, firmId))).get();
  if (!u) throw new UserError("Selected staff member was not found.");
  return u;
}

const isDone = (status: string) => status === "Completed" || status === "Filed";

/* ------------------------------------------------------------------ compliance */

export async function saveCompliance(id: string | null, _: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const auth = await authorize("compliance", "edit");
    const data = complianceSchema.parse(formToObject(fd));
    const client = ownClient(auth.firm.id, data.clientId)!;
    ownStaff(auth.firm.id, data.assignedTo);
    const filedDate = isDone(data.status) ? (data.filedDate ?? todayISO()) : (data.filedDate ?? null);
    const values = { ...data, assignedTo: data.assignedTo ?? null, filedDate, acknowledgement: data.acknowledgement ?? null, notes: data.notes ?? null };
    let recordId = id;
    if (id) {
      const prev = db.select().from(s.complianceTasks).where(and(eq(s.complianceTasks.id, id), eq(s.complianceTasks.firmId, auth.firm.id))).get();
      if (!prev) throw new UserError("Compliance task not found.");
      db.update(s.complianceTasks).set({ ...values, ...touched(auth) }).where(eq(s.complianceTasks.id, id)).run();
      if (prev.status !== data.status) logActivity(auth, { clientId: client.id, entityType: "compliance", entityId: id, action: data.status === "Filed" ? "filed" : "status", summary: `${data.complianceType} (${data.period}) ${data.status === "Filed" ? "filed" : `marked ${data.status}`}` });
      if (data.assignedTo && prev.assignedTo !== data.assignedTo) notify(auth, data.assignedTo, { kind: "task", title: "Compliance assigned to you", body: `${data.complianceType} · ${client.name} · ${data.period}`, href: `/compliance?edit=${id}` });
    } else {
      recordId = db.insert(s.complianceTasks).values({ ...values, firmId: auth.firm.id, ...audit(auth) }).returning({ id: s.complianceTasks.id }).get().id;
      logActivity(auth, { clientId: client.id, entityType: "compliance", entityId: recordId, action: "created", summary: `${data.complianceType} (${data.period}) added — due ${data.dueDate}` });
      notify(auth, data.assignedTo, { kind: "task", title: "Compliance assigned to you", body: `${data.complianceType} · ${client.name} · ${data.period}`, href: `/compliance?edit=${recordId}` });
    }
    return { ok: true, message: id ? "Compliance updated" : "Compliance task created" };
  });
}

export async function setComplianceStatus(id: string, status: string): Promise<ActionResult> {
  return runAction(async () => {
    const auth = await authorize("compliance", "edit");
    const st = z.enum(COMPLIANCE_STATUSES).parse(status);
    const row = db.select().from(s.complianceTasks).where(and(eq(s.complianceTasks.id, id), eq(s.complianceTasks.firmId, auth.firm.id))).get();
    if (!row) throw new UserError("Compliance task not found.");
    db.update(s.complianceTasks).set({ status: st, filedDate: isDone(st) ? (row.filedDate ?? todayISO()) : null, ...touched(auth) }).where(eq(s.complianceTasks.id, id)).run();
    logActivity(auth, { clientId: row.clientId, entityType: "compliance", entityId: id, action: st === "Filed" ? "filed" : "status", summary: `${row.complianceType} (${row.period}) ${st === "Filed" ? "filed" : `marked ${st}`}` });
    return { ok: true, message: `Marked ${st}` };
  });
}

export async function deleteCompliance(id: string): Promise<ActionResult> {
  return runAction(async () => {
    const auth = await authorize("compliance", "edit");
    const row = db.select().from(s.complianceTasks).where(and(eq(s.complianceTasks.id, id), eq(s.complianceTasks.firmId, auth.firm.id))).get();
    if (!row) throw new UserError("Compliance task not found.");
    db.delete(s.complianceTasks).where(eq(s.complianceTasks.id, id)).run();
    logActivity(auth, { clientId: row.clientId, entityType: "compliance", entityId: id, action: "deleted", summary: `${row.complianceType} (${row.period}) removed` });
    return { ok: true, message: "Compliance task deleted" };
  });
}

const bulkSchema = z.object({
  category: complianceSchema.shape.category,
  complianceType: complianceSchema.shape.complianceType,
  period: complianceSchema.shape.period,
  financialYear: complianceSchema.shape.financialYear,
  dueDate: complianceSchema.shape.dueDate,
  priority: complianceSchema.shape.priority,
  assignToManager: z.boolean(),
  clientIds: z.array(z.string().uuid()).min(1, "Select at least one client").max(500),
});

/** Creates the same compliance item for many clients at once, skipping duplicates. */
export async function bulkCreateCompliance(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const auth = await authorize("compliance", "edit");
    const raw = formToObject(fd);
    const data = bulkSchema.parse({ ...raw, assignToManager: raw.assignToManager === "on", clientIds: fd.getAll("clientIds") });
    const clients = db.select({ id: s.clients.id, managerId: s.clients.managerId }).from(s.clients).where(and(eq(s.clients.firmId, auth.firm.id), inArray(s.clients.id, data.clientIds))).all();
    const existing = new Set(
      db
        .select({ clientId: s.complianceTasks.clientId })
        .from(s.complianceTasks)
        .where(and(eq(s.complianceTasks.firmId, auth.firm.id), eq(s.complianceTasks.complianceType, data.complianceType), eq(s.complianceTasks.period, data.period), inArray(s.complianceTasks.clientId, data.clientIds)))
        .all()
        .map((r) => r.clientId),
    );
    const fresh = clients.filter((c) => !existing.has(c.id));
    if (fresh.length)
      db.insert(s.complianceTasks)
        .values(fresh.map((c) => ({ firmId: auth.firm.id, clientId: c.id, category: data.category, complianceType: data.complianceType, period: data.period, financialYear: data.financialYear, dueDate: data.dueDate, priority: data.priority, status: "Not Started" as const, assignedTo: data.assignToManager ? c.managerId : null, ...audit(auth) })))
        .run();
    logActivity(auth, { entityType: "compliance", action: "bulk", summary: `${data.complianceType} (${data.period}) created for ${fresh.length} clients` });
    const skipped = clients.length - fresh.length;
    return { ok: true, message: `${fresh.length} created${skipped ? `, ${skipped} already existed` : ""}` };
  });
}

/* ------------------------------------------------------------------ tasks */

export async function saveTask(id: string | null, _: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const auth = await authorize("tasks", "edit");
    const data = taskSchema.parse(formToObject(fd));
    const client = ownClient(auth.firm.id, data.clientId);
    ownStaff(auth.firm.id, data.assignedTo);
    const values = { ...data, clientId: data.clientId ?? null, assignedTo: data.assignedTo ?? null, notes: data.notes ?? null, completedAt: data.status === "Completed" ? new Date().toISOString() : null };
    if (id) {
      const prev = db.select().from(s.tasks).where(and(eq(s.tasks.id, id), eq(s.tasks.firmId, auth.firm.id))).get();
      if (!prev) throw new UserError("Task not found.");
      db.update(s.tasks).set({ ...values, completedAt: data.status === "Completed" ? (prev.completedAt ?? values.completedAt) : null, ...touched(auth) }).where(eq(s.tasks.id, id)).run();
      if (data.assignedTo && prev.assignedTo !== data.assignedTo) notify(auth, data.assignedTo, { kind: "task", title: "Task assigned to you", body: `${data.title}${client ? ` · ${client.name}` : ""}`, href: `/tasks?edit=${id}` });
      if (prev.status !== data.status && data.status === "Completed") logActivity(auth, { clientId: client?.id, entityType: "task", entityId: id, action: "completed", summary: `Task completed: ${data.title}` });
    } else {
      const newId = db.insert(s.tasks).values({ ...values, firmId: auth.firm.id, ...audit(auth) }).returning({ id: s.tasks.id }).get().id;
      logActivity(auth, { clientId: client?.id, entityType: "task", entityId: newId, action: "created", summary: `Task added: ${data.title}` });
      notify(auth, data.assignedTo, { kind: "task", title: "Task assigned to you", body: `${data.title}${client ? ` · ${client.name}` : ""}`, href: `/tasks?edit=${newId}` });
    }
    return { ok: true, message: id ? "Task updated" : "Task added" };
  });
}

export async function setTaskStatus(id: string, status: string): Promise<ActionResult> {
  return runAction(async () => {
    const auth = await authorize("tasks", "edit");
    const st = z.enum(TASK_STATUSES).parse(status);
    const t = db.select().from(s.tasks).where(and(eq(s.tasks.id, id), eq(s.tasks.firmId, auth.firm.id))).get();
    if (!t) throw new UserError("Task not found.");
    db.update(s.tasks).set({ status: st, completedAt: st === "Completed" ? new Date().toISOString() : null, ...touched(auth) }).where(eq(s.tasks.id, id)).run();
    if (st === "Completed") logActivity(auth, { clientId: t.clientId, entityType: "task", entityId: id, action: "completed", summary: `Task completed: ${t.title}` });
    return { ok: true, message: `Marked ${st}` };
  });
}

export async function deleteTask(id: string): Promise<ActionResult> {
  return runAction(async () => {
    const auth = await authorize("tasks", "edit");
    const t = db.select().from(s.tasks).where(and(eq(s.tasks.id, id), eq(s.tasks.firmId, auth.firm.id))).get();
    if (!t) throw new UserError("Task not found.");
    db.delete(s.tasks).where(eq(s.tasks.id, id)).run();
    logActivity(auth, { clientId: t.clientId, entityType: "task", entityId: id, action: "deleted", summary: `Task removed: ${t.title}` });
    return { ok: true, message: "Task deleted" };
  });
}

/* ------------------------------------------------------------------ calendar events */

export async function saveEvent(id: string | null, _: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const auth = await authorize("calendar", "edit");
    const data = eventSchema.parse(formToObject(fd));
    const client = ownClient(auth.firm.id, data.clientId);
    const values = { ...data, clientId: data.clientId ?? null, startTime: data.startTime ?? null, endTime: data.endTime ?? null, location: data.location ?? null, notes: data.notes ?? null };
    if (id) {
      const e = db.select({ id: s.calendarEvents.id }).from(s.calendarEvents).where(and(eq(s.calendarEvents.id, id), eq(s.calendarEvents.firmId, auth.firm.id))).get();
      if (!e) throw new UserError("Event not found.");
      db.update(s.calendarEvents).set({ ...values, ...touched(auth) }).where(eq(s.calendarEvents.id, id)).run();
    } else {
      db.insert(s.calendarEvents).values({ ...values, firmId: auth.firm.id, ...audit(auth) }).run();
      if (client) logActivity(auth, { clientId: client.id, entityType: "event", action: "created", summary: `${data.type} scheduled on ${data.date}: ${data.title}` });
    }
    return { ok: true, message: id ? "Event updated" : "Event added" };
  });
}

export async function deleteEvent(id: string): Promise<ActionResult> {
  return runAction(async () => {
    const auth = await authorize("calendar", "edit");
    const e = db.select({ id: s.calendarEvents.id }).from(s.calendarEvents).where(and(eq(s.calendarEvents.id, id), eq(s.calendarEvents.firmId, auth.firm.id))).get();
    if (!e) throw new UserError("Event not found.");
    db.delete(s.calendarEvents).where(eq(s.calendarEvents.id, id)).run();
    return { ok: true, message: "Event deleted" };
  });
}
