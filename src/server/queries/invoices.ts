import "server-only";
import { and, asc, desc, eq, gte, lte, sql, type SQL } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { addMonths, monthsBetween, startOfMonth, todayISO } from "@/lib/dates";
import { effectiveInvoiceStatus, outstandingOf, type InvoiceStatus } from "@/lib/invoices";

export interface InvoiceRow {
  id: string;
  number: string;
  clientId: string;
  clientName: string;
  clientMobile: string | null;
  clientEmail: string | null;
  invoiceDate: string;
  dueDate: string;
  billingPeriod: string | null;
  storedStatus: InvoiceStatus;
  status: InvoiceStatus;
  total: number;
  paid: number;
  outstanding: number;
  recurringBillId: string | null;
  sentVia: string | null;
}

const paidExpr = sql<number>`coalesce((select sum(p.amount) from payments p where p.invoice_id = ${s.invoices.id}), 0)`;

export function listInvoices(
  firmId: string,
  f: { clientId?: string; from?: string; to?: string; today?: string } = {},
): InvoiceRow[] {
  const today = f.today ?? todayISO();
  const where: SQL[] = [eq(s.invoices.firmId, firmId)];
  if (f.clientId) where.push(eq(s.invoices.clientId, f.clientId));
  if (f.from) where.push(gte(s.invoices.invoiceDate, f.from));
  if (f.to) where.push(lte(s.invoices.invoiceDate, f.to));
  const rows = db
    .select({
      id: s.invoices.id,
      number: s.invoices.number,
      clientId: s.invoices.clientId,
      clientName: s.clients.name,
      clientMobile: s.clients.mobile,
      clientEmail: s.clients.email,
      invoiceDate: s.invoices.invoiceDate,
      dueDate: s.invoices.dueDate,
      billingPeriod: s.invoices.billingPeriod,
      storedStatus: s.invoices.status,
      total: s.invoices.total,
      recurringBillId: s.invoices.recurringBillId,
      sentVia: s.invoices.sentVia,
      paid: paidExpr,
    })
    .from(s.invoices)
    .innerJoin(s.clients, eq(s.clients.id, s.invoices.clientId))
    .where(and(...where))
    .orderBy(desc(s.invoices.invoiceDate), desc(s.invoices.number))
    .all();
  return rows.map((r) => {
    const status = effectiveInvoiceStatus({ status: r.storedStatus, total: r.total, paid: r.paid, dueDate: r.dueDate }, today);
    return { ...r, status, outstanding: outstandingOf({ status: r.storedStatus, total: r.total, paid: r.paid }) };
  });
}

export function getInvoice(firmId: string, id: string) {
  const inv = db.select().from(s.invoices).where(and(eq(s.invoices.firmId, firmId), eq(s.invoices.id, id))).get();
  if (!inv) return null;
  const client = db.select().from(s.clients).where(eq(s.clients.id, inv.clientId)).get()!;
  const items = db.select().from(s.invoiceItems).where(eq(s.invoiceItems.invoiceId, id)).orderBy(asc(s.invoiceItems.sortOrder)).all();
  const pays = db.select().from(s.payments).where(eq(s.payments.invoiceId, id)).orderBy(asc(s.payments.paymentDate)).all();
  const paid = pays.reduce((a, p) => a + p.amount, 0);
  const today = todayISO();
  return {
    invoice: inv,
    client,
    items,
    payments: pays,
    paid,
    outstanding: outstandingOf({ status: inv.status, total: inv.total, paid }),
    status: effectiveInvoiceStatus({ status: inv.status, total: inv.total, paid, dueDate: inv.dueDate }, today),
  };
}

export interface BillingSummary {
  generated: number;
  collected: number;
  outstanding: number;
  overdue: number;
  overdueCount: number;
  unpaidCount: number;
}

/** Totals for invoices dated within [from, to]; collections are payments dated within the range. */
export function billingSummary(firmId: string, from: string, to: string, today = todayISO()): BillingSummary {
  const inRange = listInvoices(firmId, { from, to, today }).filter((i) => i.storedStatus !== "Draft" && i.storedStatus !== "Cancelled");
  const all = listInvoices(firmId, { today }).filter((i) => i.outstanding > 0);
  const collected =
    db
      .select({ v: sql<number>`coalesce(sum(${s.payments.amount}), 0)` })
      .from(s.payments)
      .where(and(eq(s.payments.firmId, firmId), gte(s.payments.paymentDate, from), lte(s.payments.paymentDate, to)))
      .get()?.v ?? 0;
  const overdue = all.filter((i) => i.status === "Overdue");
  return {
    generated: inRange.reduce((a, i) => a + i.total, 0),
    collected,
    outstanding: all.reduce((a, i) => a + i.outstanding, 0),
    overdue: overdue.reduce((a, i) => a + i.outstanding, 0),
    overdueCount: overdue.length,
    unpaidCount: all.length,
  };
}

/** Billed (by invoice date) and collected (by payment date) per month key YYYY-MM. */
export function monthlySeries(firmId: string, months: string[]) {
  const from = `${months[0]}-01`;
  const to = `${months[months.length - 1]}-31`;
  const billed = db
    .select({ m: sql<string>`substr(${s.invoices.invoiceDate}, 1, 7)`, v: sql<number>`sum(${s.invoices.total})` })
    .from(s.invoices)
    .where(and(eq(s.invoices.firmId, firmId), gte(s.invoices.invoiceDate, from), lte(s.invoices.invoiceDate, to), sql`${s.invoices.status} not in ('Draft','Cancelled')`))
    .groupBy(sql`1`)
    .all();
  const collected = db
    .select({ m: sql<string>`substr(${s.payments.paymentDate}, 1, 7)`, v: sql<number>`sum(${s.payments.amount})` })
    .from(s.payments)
    .where(and(eq(s.payments.firmId, firmId), gte(s.payments.paymentDate, from), lte(s.payments.paymentDate, to)))
    .groupBy(sql`1`)
    .all();
  const b = new Map(billed.map((r) => [r.m, r.v]));
  const c = new Map(collected.map((r) => [r.m, r.v]));
  return months.map((m) => ({ month: m, billed: b.get(m) ?? 0, collected: c.get(m) ?? 0 }));
}

export function listPayments(firmId: string, f: { clientId?: string; from?: string; to?: string } = {}) {
  const where: SQL[] = [eq(s.payments.firmId, firmId)];
  if (f.clientId) where.push(eq(s.payments.clientId, f.clientId));
  if (f.from) where.push(gte(s.payments.paymentDate, f.from));
  if (f.to) where.push(lte(s.payments.paymentDate, f.to));
  return db
    .select({
      id: s.payments.id,
      paymentDate: s.payments.paymentDate,
      amount: s.payments.amount,
      mode: s.payments.mode,
      reference: s.payments.reference,
      notes: s.payments.notes,
      clientId: s.payments.clientId,
      clientName: s.clients.name,
      invoiceId: s.payments.invoiceId,
      invoiceNumber: s.invoices.number,
      invoiceTotal: s.invoices.total,
    })
    .from(s.payments)
    .innerJoin(s.clients, eq(s.clients.id, s.payments.clientId))
    .leftJoin(s.invoices, eq(s.invoices.id, s.payments.invoiceId))
    .where(and(...where))
    .orderBy(desc(s.payments.paymentDate), desc(s.payments.createdAt))
    .all();
}

export function listRecurring(firmId: string) {
  const plans = db
    .select({ plan: s.recurringBills, clientName: s.clients.name, clientStatus: s.clients.status })
    .from(s.recurringBills)
    .innerJoin(s.clients, eq(s.clients.id, s.recurringBills.clientId))
    .where(eq(s.recurringBills.firmId, firmId))
    .orderBy(asc(s.clients.name))
    .all();
  const items = db.select().from(s.recurringBillItems).where(eq(s.recurringBillItems.firmId, firmId)).orderBy(asc(s.recurringBillItems.sortOrder)).all();
  return plans.map((p) => {
    const its = items.filter((i) => i.recurringBillId === p.plan.id);
    return { ...p.plan, clientName: p.clientName, clientStatus: p.clientStatus, items: its, amount: its.reduce((a, i) => a + i.amount, 0) };
  });
}

/** Months offered in the "Billing Period" picker (last 12 months + next 2), newest first. */
export function billingMonths(today: string) {
  return monthsBetween(addMonths(startOfMonth(today), -12), addMonths(startOfMonth(today), 2)).reverse();
}

/** Client → recurring fee lines, used by "Use monthly fees" on the invoice form. */
export function planMap(firmId: string) {
  return Object.fromEntries(listRecurring(firmId).map((p) => [p.clientId, p.items.map((i) => ({ service: i.service, description: i.description, amount: i.amount }))]));
}

