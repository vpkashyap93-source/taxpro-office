"use server";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db, schema as s } from "@/db";
import type { ActionResult } from "@/lib/action-types";
import { CMA_INPUT_FIELDS } from "@/lib/cma";
import { cmaSchema } from "@/lib/validation";
import { authorize } from "../auth";
import { formToObject, parseJsonField, runAction, UserError } from "../action";
import { audit, logActivity, touched } from "../activity";

const allowedKeys = new Set<string>(CMA_INPUT_FIELDS.map((f) => f.key));

function own(firmId: string, id: string) {
  const r = db.select().from(s.cmaRecords).where(and(eq(s.cmaRecords.id, id), eq(s.cmaRecords.firmId, firmId))).get();
  if (!r) throw new UserError("CMA case not found.");
  return r;
}

export async function saveCma(id: string | null, _: ActionResult<{ id: string }>, fd: FormData): Promise<ActionResult<{ id: string }>> {
  const res = await runAction<{ id: string }>(async () => {
    const auth = await authorize("cma", "edit");
    const rawInputs = parseJsonField<Record<string, unknown>>(fd, "inputs") ?? {};
    const inputs: Record<string, number> = {};
    for (const [k, v] of Object.entries(rawInputs)) {
      if (!allowedKeys.has(k) || v === "" || v === null) continue;
      const n = typeof v === "number" ? v : Number(String(v).replace(/,/g, ""));
      if (!Number.isFinite(n)) throw new UserError(`${CMA_INPUT_FIELDS.find((f) => f.key === k)?.label ?? k} must be a number.`);
      if (Math.abs(n) > 1e13) throw new UserError("One of the amounts is too large.");
      inputs[k] = n;
    }
    const data = cmaSchema.parse({ ...formToObject(fd), inputs });
    const client = db.select({ id: s.clients.id, name: s.clients.name }).from(s.clients).where(and(eq(s.clients.id, data.clientId), eq(s.clients.firmId, auth.firm.id))).get();
    if (!client) throw new UserError("Client not found.");
    const values = { clientId: data.clientId, financialYear: data.financialYear, period: data.period, purpose: data.purpose, bank: data.bank ?? null, loanAmount: data.loanAmount ?? null, status: data.status, dueDate: data.dueDate ?? null, assignedTo: data.assignedTo ?? null, notes: data.notes ?? null, inputs: JSON.stringify(data.inputs) };
    let recordId = id;
    if (id) {
      own(auth.firm.id, id);
      db.update(s.cmaRecords).set({ ...values, ...touched(auth) }).where(eq(s.cmaRecords.id, id)).run();
    } else {
      recordId = db.insert(s.cmaRecords).values({ ...values, firmId: auth.firm.id, ...audit(auth) }).returning({ id: s.cmaRecords.id }).get().id;
      logActivity(auth, { clientId: client.id, entityType: "cma", entityId: recordId, action: "created", summary: `CMA started — ${data.purpose}${data.bank ? ` (${data.bank})` : ""}` });
    }
    return { ok: true, message: id ? "CMA saved" : "CMA created", data: { id: recordId! } };
  });
  if (res.ok && res.data) {
    if (fd.get("intent") !== "stay") redirect(`/cma/${res.data.id}`);
    else if (!id) redirect(`/cma/${res.data.id}/edit`); // keep editing the newly created draft
  }
  return res;
}

export async function duplicateCma(id: string): Promise<ActionResult<{ id: string }>> {
  const res = await runAction<{ id: string }>(async () => {
    const auth = await authorize("cma", "edit");
    const r = own(auth.firm.id, id);
    const copy = db
      .insert(s.cmaRecords)
      .values({ firmId: auth.firm.id, clientId: r.clientId, financialYear: r.financialYear, period: r.period, purpose: `${r.purpose} (copy)`, bank: r.bank, loanAmount: r.loanAmount, status: "Draft", dueDate: r.dueDate, assignedTo: r.assignedTo, inputs: r.inputs, notes: r.notes, ...audit(auth) })
      .returning({ id: s.cmaRecords.id })
      .get();
    logActivity(auth, { clientId: r.clientId, entityType: "cma", entityId: copy.id, action: "duplicated", summary: `CMA duplicated from “${r.purpose}”` });
    return { ok: true, message: "CMA duplicated", data: { id: copy.id } };
  });
  if (res.ok && res.data) redirect(`/cma/${res.data.id}/edit`);
  return res;
}

export async function markCmaReportGenerated(id: string): Promise<ActionResult> {
  return runAction(async () => {
    const auth = await authorize("cma", "edit");
    const r = own(auth.firm.id, id);
    db.update(s.cmaRecords).set({ reportGeneratedAt: new Date().toISOString(), status: r.status === "Draft" || r.status === "In Preparation" ? "Review" : r.status, ...touched(auth) }).where(eq(s.cmaRecords.id, id)).run();
    logActivity(auth, { clientId: r.clientId, entityType: "cma", entityId: id, action: "report", summary: `CMA report generated — ${r.purpose}` });
    return { ok: true, message: "Report generated" };
  });
}

export async function deleteCma(id: string): Promise<ActionResult> {
  const res = await runAction(async () => {
    const auth = await authorize("cma", "edit");
    const r = own(auth.firm.id, id);
    db.delete(s.cmaRecords).where(eq(s.cmaRecords.id, id)).run();
    logActivity(auth, { clientId: r.clientId, entityType: "cma", entityId: id, action: "deleted", summary: `CMA “${r.purpose}” deleted` });
    return { ok: true, message: "CMA deleted" };
  });
  if (res.ok) redirect("/cma");
  return res;
}
