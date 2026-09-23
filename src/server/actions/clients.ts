"use server";

import { and, count, eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db, schema as s } from "@/db";
import type { ActionResult } from "@/lib/action-types";
import { clientSchema } from "@/lib/validation";
import { authorize } from "../auth";
import { runAction, formToObject, UserError } from "../action";
import { audit, logActivity, touched } from "../activity";

function parseClient(fd: FormData) {
  const raw = formToObject(fd);
  return clientSchema.parse({ ...raw, services: fd.getAll("services") });
}

function nextClientCode(firmId: string) {
  const row = db
    .select({ max: sql<number>`coalesce(max(cast(substr(${s.clients.code}, 4) as integer)), 0)` })
    .from(s.clients)
    .where(eq(s.clients.firmId, firmId))
    .get();
  return `CL-${String((row?.max ?? 0) + 1).padStart(3, "0")}`;
}

function assertStaffInFirm(firmId: string, userId: string | undefined) {
  if (!userId) return;
  const u = db.select({ id: s.users.id }).from(s.users).where(and(eq(s.users.id, userId), eq(s.users.firmId, firmId))).get();
  if (!u) throw new UserError("Selected staff member was not found.");
}

export async function createClient(_: ActionResult<{ id: string }>, fd: FormData): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const auth = await authorize("clients", "edit");
    const data = parseClient(fd);
    assertStaffInFirm(auth.firm.id, data.managerId);
    const id = db.transaction((tx) => {
      const { services, ...rest } = data;
      const row = tx
        .insert(s.clients)
        .values({ ...rest, firmId: auth.firm.id, code: nextClientCode(auth.firm.id), ...audit(auth) })
        .returning({ id: s.clients.id })
        .get();
      if (services.length) tx.insert(s.clientServices).values(services.map((service) => ({ firmId: auth.firm.id, clientId: row.id, service, ...audit(auth) }))).run();
      return row.id;
    });
    logActivity(auth, { clientId: id, entityType: "client", entityId: id, action: "created", summary: `Client ${data.name} added` });
    return { ok: true, message: `${data.name} added`, data: { id } };
  });
}

export async function updateClient(id: string, _: ActionResult<{ id: string }>, fd: FormData): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const auth = await authorize("clients", "edit");
    const data = parseClient(fd);
    assertStaffInFirm(auth.firm.id, data.managerId);
    const existing = db.select({ id: s.clients.id, status: s.clients.status }).from(s.clients).where(and(eq(s.clients.id, id), eq(s.clients.firmId, auth.firm.id))).get();
    if (!existing) throw new UserError("Client not found.");
    db.transaction((tx) => {
      const { services, ...rest } = data;
      tx.update(s.clients)
        .set({ ...rest, tradeName: rest.tradeName ?? null, mobile: rest.mobile ?? null, email: rest.email ?? null, address: rest.address ?? null, city: rest.city ?? null, state: rest.state ?? null, pan: rest.pan ?? null, gstin: rest.gstin ?? null, tan: rest.tan ?? null, udyam: rest.udyam ?? null, businessType: rest.businessType ?? null, constitution: rest.constitution ?? null, financialYear: rest.financialYear ?? null, managerId: rest.managerId ?? null, notes: rest.notes ?? null, ...touched(auth) })
        .where(eq(s.clients.id, id))
        .run();
      tx.delete(s.clientServices).where(eq(s.clientServices.clientId, id)).run();
      if (services.length) tx.insert(s.clientServices).values(services.map((service) => ({ firmId: auth.firm.id, clientId: id, service, ...audit(auth) }))).run();
    });
    logActivity(auth, { clientId: id, entityType: "client", entityId: id, action: "updated", summary: existing.status !== data.status ? `Status changed to ${data.status}` : "Client profile updated" });
    return { ok: true, message: "Client updated", data: { id } };
  });
}

/** Clients with financial history can't be deleted (audit trail) — mark them Inactive instead. */
export async function deleteClient(id: string): Promise<ActionResult> {
  const res = await runAction(async () => {
    const auth = await authorize("clients", "edit");
    if (auth.user.role !== "Admin") throw new UserError("Only an Admin can delete clients.");
    const client = db.select().from(s.clients).where(and(eq(s.clients.id, id), eq(s.clients.firmId, auth.firm.id))).get();
    if (!client) throw new UserError("Client not found.");
    const inv = db.select({ n: count() }).from(s.invoices).where(eq(s.invoices.clientId, id)).get()?.n ?? 0;
    const pay = db.select({ n: count() }).from(s.payments).where(eq(s.payments.clientId, id)).get()?.n ?? 0;
    if (inv + pay > 0) throw new UserError("This client has invoices or payments. Mark the client Inactive instead to keep the financial history.");
    db.delete(s.clients).where(eq(s.clients.id, id)).run();
    logActivity(auth, { entityType: "client", entityId: id, action: "deleted", summary: `Client ${client.name} deleted` });
    return { ok: true, message: "Client deleted" };
  });
  if (res.ok) redirect("/clients");
  return res;
}
