"use server";

import { and, eq, inArray, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db, schema as s, type DB } from "@/db";
import type { ActionResult } from "@/lib/action-types";
import { addMonths, financialYearOf, todayISO } from "@/lib/dates";
import { formatInvoiceNumber, validatePaymentAmount } from "@/lib/invoices";
import { computeInvoiceTotals, formatINR } from "@/lib/money";
import { dueDateFor, duePeriods, intervalFor } from "@/lib/recurring";
import { invoiceSchema, paymentSchema, recurringSchema } from "@/lib/validation";
import { authorize, type AuthContext } from "../auth";
import { formToObject, parseJsonField, runAction, UserError } from "../action";
import { audit, logActivity, touched } from "../activity";
import { getInvoiceSettings, getSetting } from "../settings";

type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];

/** Allocates the next invoice number for the invoice date's financial year (atomic within the transaction). */
function allocateNumber(tx: Tx, firmId: string, invoiceDate: string, userId: string): string {
  const fy = financialYearOf(invoiceDate);
  const key = `invoiceSeq:${fy}`;
  const current = getSetting<number>(firmId, key) ?? 1;
  tx.insert(s.settings)
    .values({ firmId, key, value: JSON.stringify(current + 1), createdBy: userId, updatedBy: userId })
    .onConflictDoUpdate({ target: [s.settings.firmId, s.settings.key], set: { value: JSON.stringify(current + 1), updatedBy: userId } })
    .run();
  return formatInvoiceNumber(getInvoiceSettings(firmId).prefix, fy, current);
}

function ownClient(firmId: string, clientId: string) {
  const c = db.select({ id: s.clients.id, name: s.clients.name }).from(s.clients).where(and(eq(s.clients.id, clientId), eq(s.clients.firmId, firmId))).get();
  if (!c) throw new UserError("Client not found.");
  return c;
}

function ownInvoice(firmId: string, id: string) {
  const inv = db.select().from(s.invoices).where(and(eq(s.invoices.id, id), eq(s.invoices.firmId, firmId))).get();
  if (!inv) throw new UserError("Invoice not found.");
  return inv;
}

function paidOn(invoiceId: string) {
  return db.select({ v: sql<number>`coalesce(sum(${s.payments.amount}), 0)` }).from(s.payments).where(eq(s.payments.invoiceId, invoiceId)).get()?.v ?? 0;
}

/* ------------------------------------------------------------------ invoices */

export async function saveInvoice(invoiceId: string | null, _: ActionResult<{ id: string }>, fd: FormData): Promise<ActionResult<{ id: string }>> {
  const res = await runAction<{ id: string }>(async () => {
    const auth = await authorize("billing", "edit");
    const data = invoiceSchema.parse({ ...formToObject(fd), items: parseJsonField(fd, "items") ?? [] });
    const client = ownClient(auth.firm.id, data.clientId);
    const totals = computeInvoiceTotals(data.items.map((i) => i.amount), data.discount ?? 0, data.gstRate);
    if (totals.total <= 0) throw new UserError("Invoice total must be greater than zero.");

    const id = db.transaction((tx) => {
      let id = invoiceId;
      if (id) {
        const existing = ownInvoice(auth.firm.id, id);
        if (existing.status === "Cancelled") throw new UserError("Cancelled invoices cannot be edited.");
        const paid = paidOn(id);
        if (paid > totals.total) throw new UserError(`Total cannot be less than the ${formatINR(paid)} already received.`);
        const number = existing.status === "Draft" && data.status === "Generated" ? allocateNumber(tx, auth.firm.id, data.invoiceDate, auth.user.id) : existing.number;
        tx.update(s.invoices)
          .set({ clientId: data.clientId, number, invoiceDate: data.invoiceDate, dueDate: data.dueDate, billingPeriod: data.billingPeriod ?? null, status: existing.status === "Draft" ? data.status : existing.status, subtotal: totals.subtotal, discount: totals.discount, gstRate: data.gstRate, gstAmount: totals.gstAmount, total: totals.total, notes: data.notes ?? null, ...touched(auth) })
          .where(eq(s.invoices.id, id))
          .run();
        tx.delete(s.invoiceItems).where(eq(s.invoiceItems.invoiceId, id)).run();
      } else {
        const number = data.status === "Draft" ? `DRAFT-${Date.now().toString(36).toUpperCase()}` : allocateNumber(tx, auth.firm.id, data.invoiceDate, auth.user.id);
        id = tx
          .insert(s.invoices)
          .values({ firmId: auth.firm.id, clientId: data.clientId, number, invoiceDate: data.invoiceDate, dueDate: data.dueDate, billingPeriod: data.billingPeriod ?? null, status: data.status, subtotal: totals.subtotal, discount: totals.discount, gstRate: data.gstRate, gstAmount: totals.gstAmount, total: totals.total, notes: data.notes ?? null, ...audit(auth) })
          .returning({ id: s.invoices.id })
          .get().id;
      }
      tx.insert(s.invoiceItems)
        .values(data.items.map((it, i) => ({ firmId: auth.firm.id, invoiceId: id!, service: it.service, description: it.description ?? null, amount: it.amount, sortOrder: i, ...audit(auth) })))
        .run();
      return id!;
    });
    const inv = ownInvoice(auth.firm.id, id);
    logActivity(auth, { clientId: client.id, entityType: "invoice", entityId: id, action: invoiceId ? "updated" : "created", summary: invoiceId ? `Invoice ${inv.number} updated` : `Invoice ${inv.number} ${inv.status === "Draft" ? "saved as draft" : "generated"} for ${formatINR(inv.total)}` });
    return { ok: true, message: invoiceId ? "Invoice updated" : "Invoice created", data: { id } };
  });
  if (res.ok && res.data) redirect(`/billing/invoices/${res.data.id}`);
  return res;
}

export async function finaliseInvoice(id: string): Promise<ActionResult> {
  return runAction(async () => {
    const auth = await authorize("billing", "edit");
    const inv = ownInvoice(auth.firm.id, id);
    if (inv.status !== "Draft") throw new UserError("Only drafts can be finalised.");
    const number = db.transaction((tx) => {
      const number = allocateNumber(tx, auth.firm.id, inv.invoiceDate, auth.user.id);
      tx.update(s.invoices).set({ number, status: "Generated", ...touched(auth) }).where(eq(s.invoices.id, id)).run();
      return number;
    });
    logActivity(auth, { clientId: inv.clientId, entityType: "invoice", entityId: id, action: "generated", summary: `Invoice ${number} generated for ${formatINR(inv.total)}` });
    return { ok: true, message: `Invoice ${number} generated` };
  });
}

const SEND_VIA = ["WhatsApp", "Email", "Portal", "Printed"] as const;

/** Records that the invoice was shared (the WhatsApp/email window itself is opened by the user's browser). */
export async function markInvoiceSent(id: string, via: string): Promise<ActionResult> {
  return runAction(async () => {
    const auth = await authorize("billing", "edit");
    const channel = z.enum(SEND_VIA).parse(via);
    const inv = ownInvoice(auth.firm.id, id);
    if (inv.status === "Draft") throw new UserError("Finalise the draft before sending it.");
    if (inv.status === "Cancelled") throw new UserError("Cancelled invoices cannot be sent.");
    db.update(s.invoices)
      .set({ status: inv.status === "Generated" ? "Sent" : inv.status, sentAt: new Date().toISOString(), sentVia: channel === "Printed" ? inv.sentVia : channel, ...touched(auth) })
      .where(eq(s.invoices.id, id))
      .run();
    logActivity(auth, { clientId: inv.clientId, entityType: "invoice", entityId: id, action: "sent", summary: `Invoice ${inv.number} ${channel === "Printed" ? "printed" : `sent via ${channel}`}` });
    return { ok: true, message: channel === "Printed" ? "Marked as printed" : `Marked as sent via ${channel}` };
  });
}

export async function logReminder(id: string, via: string): Promise<ActionResult> {
  return runAction(async () => {
    const auth = await authorize("billing", "edit");
    const channel = z.enum(SEND_VIA).parse(via);
    const inv = ownInvoice(auth.firm.id, id);
    logActivity(auth, { clientId: inv.clientId, entityType: "invoice", entityId: id, action: "reminder", summary: `Payment reminder for ${inv.number} sent via ${channel}` });
    return { ok: true, message: "Reminder logged" };
  });
}

export async function cancelInvoice(id: string): Promise<ActionResult> {
  return runAction(async () => {
    const auth = await authorize("billing", "edit");
    const inv = ownInvoice(auth.firm.id, id);
    if (paidOn(id) > 0) throw new UserError("This invoice has payments recorded. Delete the payments first, or issue a credit note.");
    if (inv.status === "Draft") {
      db.delete(s.invoices).where(eq(s.invoices.id, id)).run();
      logActivity(auth, { clientId: inv.clientId, entityType: "invoice", entityId: id, action: "deleted", summary: `Draft invoice deleted` });
      return { ok: true, message: "Draft deleted" };
    }
    db.update(s.invoices).set({ status: "Cancelled", ...touched(auth) }).where(eq(s.invoices.id, id)).run();
    logActivity(auth, { clientId: inv.clientId, entityType: "invoice", entityId: id, action: "cancelled", summary: `Invoice ${inv.number} cancelled` });
    return { ok: true, message: `Invoice ${inv.number} cancelled` };
  });
}

/* ------------------------------------------------------------------ payments */

export async function recordPayment(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const auth = await authorize("payments", "edit");
    const data = paymentSchema.parse(formToObject(fd));
    const client = ownClient(auth.firm.id, data.clientId);
    if (data.paymentDate > todayISO()) throw new UserError("Payment date cannot be in the future.");
    let invoiceNumber: string | null = null;
    db.transaction(() => {
      if (data.invoiceId) {
        const inv = ownInvoice(auth.firm.id, data.invoiceId);
        if (inv.clientId !== data.clientId) throw new UserError("Selected invoice belongs to a different client.");
        const err = validatePaymentAmount(data.amount, { total: inv.total, paid: paidOn(inv.id), status: inv.status });
        if (err) throw new UserError(err);
        invoiceNumber = inv.number;
      }
      db.insert(s.payments).values({ firmId: auth.firm.id, clientId: data.clientId, invoiceId: data.invoiceId ?? null, paymentDate: data.paymentDate, amount: data.amount, mode: data.mode, reference: data.reference ?? null, notes: data.notes ?? null, ...audit(auth) }).run();
    });
    logActivity(auth, { clientId: client.id, entityType: "payment", entityId: data.invoiceId ?? null, action: "received", summary: `Payment of ${formatINR(data.amount)} received${invoiceNumber ? ` against ${invoiceNumber}` : " on account"} (${data.mode})` });
    return { ok: true, message: `Payment of ${formatINR(data.amount)} recorded` };
  });
}

export async function deletePayment(id: string): Promise<ActionResult> {
  return runAction(async () => {
    const auth = await authorize("payments", "edit");
    if (auth.user.role !== "Admin" && auth.user.role !== "Billing Staff") throw new UserError("Only Admin or Billing Staff can delete payments.");
    const p = db.select().from(s.payments).where(and(eq(s.payments.id, id), eq(s.payments.firmId, auth.firm.id))).get();
    if (!p) throw new UserError("Payment not found.");
    db.delete(s.payments).where(eq(s.payments.id, id)).run();
    logActivity(auth, { clientId: p.clientId, entityType: "payment", entityId: p.invoiceId, action: "deleted", summary: `Payment of ${formatINR(p.amount)} dated ${p.paymentDate} deleted` });
    return { ok: true, message: "Payment deleted" };
  });
}

/* ------------------------------------------------------------------ recurring billing */

export async function saveRecurring(planId: string | null, _: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const auth = await authorize("billing", "edit");
    const raw = formToObject(fd);
    const next = typeof raw.nextPeriodStart === "string" && /^\d{4}-\d{2}$/.test(raw.nextPeriodStart) ? `${raw.nextPeriodStart}-01` : raw.nextPeriodStart;
    const data = recurringSchema.parse({ ...raw, nextPeriodStart: next, active: raw.active === "on" || raw.active === "true", items: parseJsonField(fd, "items") ?? [] });
    const client = ownClient(auth.firm.id, data.clientId);
    const intervalMonths = intervalFor(data.frequency, data.intervalMonths);
    const values = { clientId: data.clientId, active: data.active, frequency: data.frequency, intervalMonths, nextPeriodStart: `${data.nextPeriodStart.slice(0, 7)}-01`, dueDays: data.dueDays, gstRate: data.gstRate, notes: data.notes ?? null };
    db.transaction((tx) => {
      let id = planId;
      if (id) {
        const plan = tx.select().from(s.recurringBills).where(and(eq(s.recurringBills.id, id), eq(s.recurringBills.firmId, auth.firm.id))).get();
        if (!plan) throw new UserError("Recurring plan not found.");
        tx.update(s.recurringBills).set({ ...values, ...touched(auth) }).where(eq(s.recurringBills.id, id)).run();
        tx.delete(s.recurringBillItems).where(eq(s.recurringBillItems.recurringBillId, id)).run();
      } else {
        const dup = tx.select({ id: s.recurringBills.id }).from(s.recurringBills).where(eq(s.recurringBills.clientId, data.clientId)).get();
        if (dup) throw new UserError(`${client.name} already has a recurring plan — edit it instead.`);
        id = tx.insert(s.recurringBills).values({ ...values, firmId: auth.firm.id, ...audit(auth) }).returning({ id: s.recurringBills.id }).get().id;
      }
      tx.insert(s.recurringBillItems).values(data.items.map((it, i) => ({ firmId: auth.firm.id, recurringBillId: id!, service: it.service, description: it.description ?? null, amount: it.amount, sortOrder: i, ...audit(auth) }))).run();
    });
    const total = data.items.reduce((a, i) => a + i.amount, 0);
    logActivity(auth, { clientId: client.id, entityType: "recurring", action: planId ? "updated" : "created", summary: `Recurring billing ${data.active ? "ON" : "OFF"} — ${data.frequency} ${formatINR(total)}` });
    return { ok: true, message: planId ? "Recurring plan updated" : "Recurring billing set up" };
  });
}

export async function toggleRecurring(planId: string, active: boolean): Promise<ActionResult> {
  return runAction(async () => {
    const auth = await authorize("billing", "edit");
    const plan = db.select().from(s.recurringBills).where(and(eq(s.recurringBills.id, planId), eq(s.recurringBills.firmId, auth.firm.id))).get();
    if (!plan) throw new UserError("Recurring plan not found.");
    db.update(s.recurringBills).set({ active, ...touched(auth) }).where(eq(s.recurringBills.id, planId)).run();
    logActivity(auth, { clientId: plan.clientId, entityType: "recurring", entityId: planId, action: "toggled", summary: `Recurring billing turned ${active ? "ON" : "OFF"}` });
    return { ok: true, message: `Recurring billing ${active ? "ON" : "OFF"}` };
  });
}

export async function deleteRecurring(planId: string): Promise<ActionResult> {
  return runAction(async () => {
    const auth = await authorize("billing", "edit");
    const plan = db.select().from(s.recurringBills).where(and(eq(s.recurringBills.id, planId), eq(s.recurringBills.firmId, auth.firm.id))).get();
    if (!plan) throw new UserError("Recurring plan not found.");
    db.delete(s.recurringBills).where(eq(s.recurringBills.id, planId)).run();
    logActivity(auth, { clientId: plan.clientId, entityType: "recurring", entityId: planId, action: "deleted", summary: "Recurring billing plan removed" });
    return { ok: true, message: "Recurring plan removed" };
  });
}

/**
 * Generates invoices (status "Generated" — NOT sent) for the selected plans, for every period due
 * up to `uptoMonth`. Duplicate periods are prevented by a unique index on (plan, period).
 */
export async function generateRecurringBills(input: { uptoMonth: string; invoiceDate: string; planIds: string[] }): Promise<ActionResult<{ count: number; total: number }>> {
  return runAction(async () => {
    const auth = await authorize("billing", "edit");
    const data = z
      .object({ uptoMonth: z.string().regex(/^\d{4}-\d{2}$/), invoiceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), planIds: z.array(z.string().uuid()).min(1, "Select at least one client").max(500) })
      .parse(input);
    const result = generateFor(auth, data);
    if (result.count === 0) throw new UserError("Nothing to generate — the selected periods are already billed.");
    return { ok: true, message: `${result.count} invoice${result.count === 1 ? "" : "s"} generated (${formatINR(result.total)}). Review and send them from the Bill Tracker.`, data: result };
  });
}

function generateFor(auth: AuthContext, data: { uptoMonth: string; invoiceDate: string; planIds: string[] }) {
  const plans = db.select().from(s.recurringBills).where(and(eq(s.recurringBills.firmId, auth.firm.id), inArray(s.recurringBills.id, data.planIds), eq(s.recurringBills.active, true))).all();
  const items = plans.length ? db.select().from(s.recurringBillItems).where(inArray(s.recurringBillItems.recurringBillId, plans.map((p) => p.id))).all() : [];
  let count = 0;
  let total = 0;
  const created: { clientId: string; number: string; total: number }[] = [];
  db.transaction((tx) => {
    for (const plan of plans) {
      const lines = items.filter((i) => i.recurringBillId === plan.id).sort((a, b) => a.sortOrder - b.sortOrder);
      if (!lines.length) continue;
      const periods = duePeriods(plan.nextPeriodStart, plan.intervalMonths, data.uptoMonth);
      for (const period of periods) {
        const exists = tx.select({ id: s.invoices.id }).from(s.invoices).where(and(eq(s.invoices.recurringBillId, plan.id), eq(s.invoices.billingPeriod, period.key))).get();
        if (exists) continue;
        const totals = computeInvoiceTotals(lines.map((l) => l.amount), 0, plan.gstRate);
        const number = allocateNumber(tx, auth.firm.id, data.invoiceDate, auth.user.id);
        const inv = tx
          .insert(s.invoices)
          .values({ firmId: auth.firm.id, clientId: plan.clientId, number, invoiceDate: data.invoiceDate, dueDate: dueDateFor(data.invoiceDate, plan.dueDays), billingPeriod: period.key, status: "Generated", subtotal: totals.subtotal, discount: 0, gstRate: plan.gstRate, gstAmount: totals.gstAmount, total: totals.total, recurringBillId: plan.id, ...audit(auth) })
          .returning({ id: s.invoices.id })
          .get();
        tx.insert(s.invoiceItems).values(lines.map((l, i) => ({ firmId: auth.firm.id, invoiceId: inv.id, service: l.service, description: `${l.description ?? l.service} — ${period.label}`, amount: l.amount, sortOrder: i, ...audit(auth) }))).run();
        count++;
        total += totals.total;
        created.push({ clientId: plan.clientId, number, total: totals.total });
      }
      if (periods.length) {
        const last = periods[periods.length - 1]!;
        const after = addMonths(last.periodStart, plan.intervalMonths);
        tx.update(s.recurringBills).set({ nextPeriodStart: after, ...touched(auth) }).where(eq(s.recurringBills.id, plan.id)).run();
      }
    }
  });
  for (const c of created) logActivity(auth, { clientId: c.clientId, entityType: "invoice", action: "created", summary: `Recurring invoice ${c.number} generated for ${formatINR(c.total)}` });
  return { count, total };
}
