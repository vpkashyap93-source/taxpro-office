import "server-only";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";

export function getSetting<T>(firmId: string, key: string): T | null {
  const row = db
    .select({ value: schema.settings.value })
    .from(schema.settings)
    .where(and(eq(schema.settings.firmId, firmId), eq(schema.settings.key, key)))
    .get();
  if (!row) return null;
  try {
    return JSON.parse(row.value) as T;
  } catch {
    return null;
  }
}

export function setSetting(firmId: string, key: string, value: unknown, userId?: string) {
  db.insert(schema.settings)
    .values({ firmId, key, value: JSON.stringify(value), createdBy: userId, updatedBy: userId })
    .onConflictDoUpdate({
      target: [schema.settings.firmId, schema.settings.key],
      set: { value: JSON.stringify(value), updatedBy: userId, updatedAt: new Date().toISOString() },
    })
    .run();
}

export interface InvoiceSettings {
  prefix: string; // e.g. "TPO" → TPO/2026-27/0001 (sequence resets each financial year)
  defaultDueDays: number;
  defaultGstRate: number;
  sac: string;
  terms: string;
}

export interface BankSettings {
  accountName: string;
  bankName: string;
  accountNumber: string;
  ifsc: string;
  upiId: string;
}

export const DEFAULT_INVOICE_SETTINGS: InvoiceSettings = {
  prefix: "TPO",
  defaultDueDays: 15,
  defaultGstRate: 18,
  sac: "998231",
  terms: "Payment due within the due date. Please quote the invoice number with your payment.",
};

export function getInvoiceSettings(firmId: string): InvoiceSettings {
  return { ...DEFAULT_INVOICE_SETTINGS, ...(getSetting<Partial<InvoiceSettings>>(firmId, "invoice") ?? {}) };
}

export function getBankSettings(firmId: string): BankSettings | null {
  return getSetting<BankSettings>(firmId, "bank");
}
