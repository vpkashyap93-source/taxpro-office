"use server";

import { and, eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import type { ActionResult } from "@/lib/action-types";
import { dscSchema, noticeSchema } from "@/lib/validation";
import { authorize } from "../auth";
import { formToObject, runAction, UserError } from "../action";
import { audit, logActivity, notify, touched } from "../activity";

function ownClient(firmId: string, id: string) {
  const c = db.select({ id: s.clients.id, name: s.clients.name }).from(s.clients).where(and(eq(s.clients.id, id), eq(s.clients.firmId, firmId))).get();
  if (!c) throw new UserError("Client not found.");
  return c;
}

export async function saveNotice(id: string | null, _: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const auth = await authorize("notices", "edit");
    const d = noticeSchema.parse(formToObject(fd));
    const client = ownClient(auth.firm.id, d.clientId);
    const values = { ...d, section: d.section ?? null, dueDate: d.dueDate ?? null, reference: d.reference ?? null, assignedTo: d.assignedTo ?? null, responseDate: d.responseDate ?? null, notes: d.notes ?? null };
    if (id) {
      const prev = db.select().from(s.notices).where(and(eq(s.notices.id, id), eq(s.notices.firmId, auth.firm.id))).get();
      if (!prev) throw new UserError("Notice not found.");
      db.update(s.notices).set({ ...values, ...touched(auth) }).where(eq(s.notices.id, id)).run();
      if (prev.status !== d.status) logActivity(auth, { clientId: client.id, entityType: "notice", entityId: id, action: "status", summary: `${d.department} notice (${d.noticeType}) — ${d.status}` });
      if (d.assignedTo && d.assignedTo !== prev.assignedTo) notify(auth, d.assignedTo, { kind: "notice", title: "Notice assigned to you", body: `${client.name} · ${d.noticeType}`, href: `/notices?edit=${id}` });
    } else {
      const newId = db.insert(s.notices).values({ ...values, firmId: auth.firm.id, ...audit(auth) }).returning({ id: s.notices.id }).get().id;
      logActivity(auth, { clientId: client.id, entityType: "notice", entityId: newId, action: "received", summary: `${d.department} notice received — ${d.noticeType}` });
      notify(auth, d.assignedTo, { kind: "notice", title: "Notice assigned to you", body: `${client.name} · ${d.noticeType}`, href: `/notices?edit=${newId}` });
    }
    return { ok: true, message: id ? "Notice updated" : "Notice added" };
  });
}

export async function deleteNotice(id: string): Promise<ActionResult> {
  return runAction(async () => {
    const auth = await authorize("notices", "edit");
    const n = db.select().from(s.notices).where(and(eq(s.notices.id, id), eq(s.notices.firmId, auth.firm.id))).get();
    if (!n) throw new UserError("Notice not found.");
    db.delete(s.notices).where(eq(s.notices.id, id)).run();
    logActivity(auth, { clientId: n.clientId, entityType: "notice", entityId: id, action: "deleted", summary: `Notice removed — ${n.noticeType}` });
    return { ok: true, message: "Notice deleted" };
  });
}

export async function saveDsc(id: string | null, _: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const auth = await authorize("dsc", "edit");
    const d = dscSchema.parse(formToObject(fd));
    const client = ownClient(auth.firm.id, d.clientId);
    const values = { ...d, dscClass: d.dscClass ?? null, custody: d.custody ?? null, notes: d.notes ?? null };
    if (id) {
      const prev = db.select({ id: s.dscRecords.id }).from(s.dscRecords).where(and(eq(s.dscRecords.id, id), eq(s.dscRecords.firmId, auth.firm.id))).get();
      if (!prev) throw new UserError("DSC record not found.");
      db.update(s.dscRecords).set({ ...values, ...touched(auth) }).where(eq(s.dscRecords.id, id)).run();
    } else {
      db.insert(s.dscRecords).values({ ...values, firmId: auth.firm.id, ...audit(auth) }).run();
    }
    logActivity(auth, { clientId: client.id, entityType: "dsc", action: id ? "updated" : "created", summary: `DSC ${id ? "updated" : "added"} — ${d.holderName}, expires ${d.expiryDate}` });
    return { ok: true, message: id ? "DSC updated" : "DSC added" };
  });
}

export async function deleteDsc(id: string): Promise<ActionResult> {
  return runAction(async () => {
    const auth = await authorize("dsc", "edit");
    const d = db.select().from(s.dscRecords).where(and(eq(s.dscRecords.id, id), eq(s.dscRecords.firmId, auth.firm.id))).get();
    if (!d) throw new UserError("DSC record not found.");
    db.delete(s.dscRecords).where(eq(s.dscRecords.id, id)).run();
    return { ok: true, message: "DSC record deleted" };
  });
}
