/**
 * Server-side validation schemas (Zod). Shared with the client only for types/constants —
 * every mutation re-validates on the server.
 */
import { z } from "zod";
import {
  BILLING_FREQUENCIES,
  BILLING_SERVICES,
  CLIENT_STATUSES,
  CMA_STATUSES,
  COMPLIANCE_CATEGORIES,
  COMPLIANCE_STATUSES,
  DEPARTMENTS,
  DOCUMENT_STATUSES,
  DSC_RENEWAL_STATUSES,
  EVENT_TYPES,
  INVOICE_STATUSES,
  NOTICE_STATUSES,
  PAYMENT_MODES,
  PRIORITIES,
  ROLES,
  SERVICES,
  TASK_CATEGORIES,
  TASK_STATUSES,
} from "@/db/schema";
import { GSTIN_RE, MOBILE_RE, PAN_RE, TAN_RE, UDYAM_RE, isValidGstin } from "./identifiers";
import { parseRupeesToPaise } from "./money";

const emptyToUndef = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);
const trimmed = (max = 200) => z.string().trim().max(max);
const optText = (max = 500) => z.preprocess(emptyToUndef, trimmed(max).optional());
const upper = (v: unknown) => (typeof v === "string" ? v.trim().toUpperCase() : v);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date");
const optDate = z.preprocess(emptyToUndef, isoDate.optional());
const optId = z.preprocess(emptyToUndef, z.string().uuid().optional());

/** Accepts "4,500.50" style input and yields paise. */
export const money = (label = "Amount") =>
  z.preprocess(
    (v) => parseRupeesToPaise(v),
    z.number({ error: `${label} must be a number` }).refine(Number.isFinite, `${label} must be a number`).refine((n) => n >= 0, `${label} cannot be negative`).refine((n) => n <= 100_000_000_00, `${label} is too large`),
  );
const optMoney = (label?: string) => z.preprocess(emptyToUndef, money(label).optional());

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password").max(200),
});

export const clientSchema = z
  .object({
    name: trimmed(150).min(2, "Client name is required"),
    tradeName: optText(150),
    mobile: z.preprocess(emptyToUndef, z.string().trim().regex(MOBILE_RE, "Enter a 10-digit mobile number").optional()),
    email: z.preprocess(emptyToUndef, z.string().trim().toLowerCase().email("Enter a valid email").optional()),
    address: optText(300),
    city: optText(80),
    state: optText(80),
    pan: z.preprocess((v) => emptyToUndef(upper(v)), z.string().regex(PAN_RE, "PAN format: ABCDE1234F").optional()),
    gstin: z.preprocess(
      (v) => emptyToUndef(upper(v)),
      z.string().regex(GSTIN_RE, "GSTIN format: 22ABCDE1234F1Z5").refine(isValidGstin, "GSTIN check digit is invalid — please re-check").optional(),
    ),
    tan: z.preprocess((v) => emptyToUndef(upper(v)), z.string().regex(TAN_RE, "TAN format: ABCD12345E").optional()),
    udyam: z.preprocess((v) => emptyToUndef(upper(v)), z.string().regex(UDYAM_RE, "Udyam format: UDYAM-XX-00-0000000").optional()),
    businessType: optText(60),
    constitution: optText(60),
    financialYear: z.preprocess(emptyToUndef, z.string().regex(/^\d{4}-\d{2}$/, "Use format 2026-27").optional()),
    status: z.enum(CLIENT_STATUSES),
    managerId: optId,
    notes: optText(2000),
    services: z.array(z.enum(SERVICES)).default([]),
  })
  .refine((c) => !c.gstin || !c.pan || c.gstin.slice(2, 12) === c.pan, { path: ["gstin"], message: "GSTIN does not contain this client's PAN" });

export const invoiceItemSchema = z.object({
  service: z.enum(BILLING_SERVICES),
  description: optText(300),
  amount: money("Line amount").refine((n) => n > 0, "Line amount must be greater than zero"),
});

export const invoiceSchema = z.object({
  clientId: z.string().uuid("Select a client"),
  invoiceDate: isoDate,
  dueDate: isoDate,
  billingPeriod: optText(40),
  gstRate: z.coerce.number().int().min(0).max(28),
  discount: optMoney("Discount"),
  notes: optText(1000),
  status: z.enum(["Draft", "Generated"]),
  items: z.array(invoiceItemSchema).min(1, "Add at least one line item").max(30),
}).refine((v) => v.dueDate >= v.invoiceDate, { path: ["dueDate"], message: "Due date cannot be before invoice date" });

export const invoiceStatusSchema = z.object({ status: z.enum(INVOICE_STATUSES) });

export const recurringSchema = z.object({
  clientId: z.string().uuid("Select a client"),
  active: z.boolean(),
  frequency: z.enum(BILLING_FREQUENCIES),
  intervalMonths: z.coerce.number().int().min(1).max(24).optional(),
  nextPeriodStart: isoDate,
  dueDays: z.coerce.number().int().min(0).max(120),
  gstRate: z.coerce.number().int().min(0).max(28),
  notes: optText(500),
  items: z.array(invoiceItemSchema).min(1, "Add at least one fee line").max(20),
});

export const paymentSchema = z.object({
  clientId: z.string().uuid("Select a client"),
  invoiceId: optId,
  paymentDate: isoDate,
  amount: money("Amount").refine((n) => n > 0, "Amount must be greater than zero"),
  mode: z.enum(PAYMENT_MODES),
  reference: optText(80),
  notes: optText(500),
});

export const complianceSchema = z.object({
  clientId: z.string().uuid("Select a client"),
  category: z.enum(COMPLIANCE_CATEGORIES),
  complianceType: trimmed(80).min(1, "Select the compliance type"),
  period: trimmed(40).min(1, "Enter the period"),
  financialYear: z.string().regex(/^\d{4}-\d{2}$/, "Use format 2026-27"),
  dueDate: isoDate,
  assignedTo: optId,
  priority: z.enum(PRIORITIES),
  status: z.enum(COMPLIANCE_STATUSES),
  filedDate: optDate,
  acknowledgement: optText(80),
  notes: optText(2000),
});

export const taskSchema = z.object({
  title: trimmed(200).min(2, "Task name is required"),
  clientId: optId,
  category: z.enum(TASK_CATEGORIES),
  assignedTo: optId,
  priority: z.enum(PRIORITIES),
  dueDate: isoDate,
  status: z.enum(TASK_STATUSES),
  notes: optText(2000),
});

export const checklistSchema = z.object({
  clientId: z.string().uuid("Select a client"),
  title: trimmed(120).min(2, "Enter a title, e.g. September 2026 GST"),
  period: optText(40),
  category: z.enum(COMPLIANCE_CATEGORIES),
  dueDate: optDate,
  notes: optText(1000),
  items: z.array(trimmed(120).min(1)).min(1, "Add at least one required document").max(30),
});

export const documentStatusSchema = z.object({ status: z.enum(DOCUMENT_STATUSES), notes: optText(1000) });

export const cmaSchema = z.object({
  clientId: z.string().uuid("Select a client"),
  financialYear: z.string().regex(/^\d{4}-\d{2}$/, "Use format 2026-27"),
  period: trimmed(120).min(1, "Enter the period"),
  purpose: trimmed(160).min(2, "Enter the purpose"),
  bank: optText(120),
  loanAmount: optMoney("Loan amount"),
  status: z.enum(CMA_STATUSES),
  dueDate: optDate,
  assignedTo: optId,
  notes: optText(2000),
  inputs: z.record(z.string(), z.number().finite()).default({}),
});

export const eventSchema = z.object({
  title: trimmed(160).min(2, "Enter a title"),
  type: z.enum(EVENT_TYPES),
  clientId: optId,
  date: isoDate,
  startTime: z.preprocess(emptyToUndef, z.string().regex(/^\d{2}:\d{2}$/).optional()),
  endTime: z.preprocess(emptyToUndef, z.string().regex(/^\d{2}:\d{2}$/).optional()),
  location: optText(120),
  notes: optText(1000),
});

export const noticeSchema = z.object({
  clientId: z.string().uuid("Select a client"),
  department: z.enum(DEPARTMENTS),
  noticeType: trimmed(160).min(2, "Enter the notice type"),
  section: optText(60),
  noticeDate: isoDate,
  dueDate: optDate,
  reference: optText(80),
  assignedTo: optId,
  status: z.enum(NOTICE_STATUSES),
  responseDate: optDate,
  notes: optText(2000),
});

export const dscSchema = z
  .object({
    clientId: z.string().uuid("Select a client"),
    holderName: trimmed(120).min(2, "Enter the DSC holder's name"),
    dscClass: optText(30),
    issueDate: isoDate,
    expiryDate: isoDate,
    renewalStatus: z.enum(DSC_RENEWAL_STATUSES),
    custody: optText(60),
    notes: optText(1000),
  })
  .refine((v) => v.expiryDate > v.issueDate, { path: ["expiryDate"], message: "Expiry must be after issue date" });

export const passwordRule = z
  .string()
  .min(10, "Use at least 10 characters")
  .max(200)
  .regex(/[A-Za-z]/, "Include at least one letter")
  .regex(/[0-9]/, "Include at least one number");

export const userSchema = z.object({
  name: trimmed(100).min(2, "Enter the name"),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  phone: z.preprocess(emptyToUndef, z.string().trim().regex(MOBILE_RE, "Enter a 10-digit mobile number").optional()),
  role: z.enum(ROLES).refine((r) => r !== "Client", "Invalid role"),
  designation: optText(80),
  password: z.preprocess(emptyToUndef, passwordRule.optional()),
  active: z.boolean(),
});

export const firmSchema = z.object({
  name: trimmed(150).min(2, "Enter the firm name"),
  legalName: optText(150),
  gstin: z.preprocess((v) => emptyToUndef(upper(v)), z.string().regex(GSTIN_RE, "Invalid GSTIN format").refine(isValidGstin, "GSTIN check digit is invalid").optional()),
  pan: z.preprocess((v) => emptyToUndef(upper(v)), z.string().regex(PAN_RE, "Invalid PAN format").optional()),
  email: z.preprocess(emptyToUndef, z.string().trim().email("Enter a valid email").optional()),
  phone: optText(20),
  address: optText(300),
  state: optText(80),
});

export type FieldErrors = Record<string, string[]>;

/** Flattens a ZodError into { "field.path": [messages] } */
export function zodFieldErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    (out[key] ??= []).push(issue.message);
  }
  return out;
}
