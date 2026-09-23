/** Pure invoice domain rules (shared by server services, UI and tests). */
import type { INVOICE_STATUSES } from "@/db/schema";
import { diffDays } from "./dates";

export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export interface InvoiceLike {
  status: InvoiceStatus;
  total: number;
  paid: number;
  dueDate: string;
}

/**
 * Effective status derived from the stored lifecycle status + payments + due date.
 * Draft and Cancelled are terminal user states; otherwise payments and due date decide.
 */
export function effectiveInvoiceStatus(inv: InvoiceLike, today: string): InvoiceStatus {
  if (inv.status === "Draft" || inv.status === "Cancelled") return inv.status;
  const outstanding = inv.total - inv.paid;
  if (outstanding <= 0) return "Paid";
  if (inv.dueDate < today) return "Overdue";
  if (inv.paid > 0) return "Partially Paid";
  return inv.status === "Sent" ? "Sent" : "Generated";
}

export function outstandingOf(inv: { status: InvoiceStatus; total: number; paid: number }): number {
  if (inv.status === "Draft" || inv.status === "Cancelled") return 0;
  return Math.max(0, inv.total - inv.paid);
}

export function daysOverdue(dueDate: string, today: string): number {
  return Math.max(0, diffDays(dueDate, today));
}

/** Validates that a new payment doesn't exceed what's outstanding on the invoice. */
export function validatePaymentAmount(amount: number, invoice: { total: number; paid: number; status: InvoiceStatus } | null): string | null {
  if (!Number.isFinite(amount) || amount <= 0) return "Amount must be greater than zero.";
  if (!invoice) return null;
  if (invoice.status === "Draft") return "Finalise (generate) the invoice before recording a payment.";
  if (invoice.status === "Cancelled") return "Cannot record a payment against a cancelled invoice.";
  const outstanding = Math.max(0, invoice.total - invoice.paid);
  if (amount > outstanding) return `Amount exceeds the outstanding balance.`;
  return null;
}

export function formatInvoiceNumber(prefix: string, fy: string, seq: number): string {
  return `${prefix}/${fy}/${String(seq).padStart(4, "0")}`;
}
