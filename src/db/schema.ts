/**
 * TaxPro Office — relational data model.
 *
 * Conventions
 * - Every business table is scoped by `firmId` (multi-firm SaaS ready).
 * - Every important record carries audit columns: id, createdAt, updatedAt, createdBy, updatedBy.
 * - Money is stored as INTEGER paise to avoid floating point errors (₹1 = 100).
 * - Calendar dates are ISO strings "YYYY-MM-DD"; timestamps are ISO-8601 strings.
 * - Statutory due dates are never hard-coded: they live in data (complianceTypes / each task).
 */
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const id = () => text("id").primaryKey().$defaultFn(() => crypto.randomUUID());
const now = () => new Date().toISOString();

const audit = {
  createdAt: text("created_at").notNull().$defaultFn(now),
  updatedAt: text("updated_at").notNull().$defaultFn(now).$onUpdateFn(now),
  createdBy: text("created_by"),
  updatedBy: text("updated_by"),
};

const firmId = () => text("firm_id").notNull().references(() => firms.id, { onDelete: "cascade" });

/* ------------------------------------------------------------------ Firms & users */

export const firms = sqliteTable("firms", {
  id: id(),
  name: text("name").notNull(),
  legalName: text("legal_name"),
  gstin: text("gstin"),
  pan: text("pan"),
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  state: text("state"),
  ...audit,
});

export const ROLES = ["Admin", "Senior", "Junior", "Billing Staff", "Client"] as const;
export type Role = (typeof ROLES)[number];

/** Staff members are users with a staff role. Client-portal users carry role "Client" + clientId. */
export const users = sqliteTable(
  "users",
  {
    id: id(),
    firmId: firmId(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    passwordHash: text("password_hash").notNull(),
    role: text("role", { enum: ROLES }).notNull(),
    designation: text("designation"),
    clientId: text("client_id"),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    lastLoginAt: text("last_login_at"),
    ...audit,
  },
  (t) => [uniqueIndex("users_email_uq").on(t.email), index("users_firm_idx").on(t.firmId)],
);

export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(), // SHA-256 of the opaque cookie token (token itself is never stored)
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    expiresAt: text("expires_at").notNull(),
    createdAt: text("created_at").notNull().$defaultFn(now),
    userAgent: text("user_agent"),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

/** Firm-level settings (key/value JSON). Permissions matrix, invoice numbering, bank details, etc. */
export const settings = sqliteTable(
  "settings",
  {
    id: id(),
    firmId: firmId(),
    key: text("key").notNull(),
    value: text("value").notNull(), // JSON
    ...audit,
  },
  (t) => [uniqueIndex("settings_firm_key_uq").on(t.firmId, t.key)],
);

/* ------------------------------------------------------------------ Clients */

export const CLIENT_STATUSES = ["Active", "Inactive", "Prospect", "On Hold"] as const;
export const SERVICES = [
  "GST",
  "ITR",
  "TDS",
  "Accounting",
  "CMA",
  "Audit",
  "ROC",
  "Payroll",
  "DSC",
  "Other",
] as const;

export const clients = sqliteTable(
  "clients",
  {
    id: id(),
    firmId: firmId(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    tradeName: text("trade_name"),
    mobile: text("mobile"),
    email: text("email"),
    address: text("address"),
    city: text("city"),
    state: text("state"),
    pan: text("pan"),
    gstin: text("gstin"),
    tan: text("tan"),
    udyam: text("udyam"),
    businessType: text("business_type"),
    constitution: text("constitution"),
    financialYear: text("financial_year"),
    status: text("status", { enum: CLIENT_STATUSES }).notNull().default("Active"),
    managerId: text("manager_id").references(() => users.id, { onDelete: "set null" }),
    notes: text("notes"),
    ...audit,
  },
  (t) => [
    index("clients_firm_idx").on(t.firmId),
    uniqueIndex("clients_firm_code_uq").on(t.firmId, t.code),
    index("clients_pan_idx").on(t.pan),
    index("clients_gstin_idx").on(t.gstin),
  ],
);

export const clientServices = sqliteTable(
  "client_services",
  {
    id: id(),
    firmId: firmId(),
    clientId: text("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
    service: text("service", { enum: SERVICES }).notNull(),
    ...audit,
  },
  (t) => [uniqueIndex("client_services_uq").on(t.clientId, t.service)],
);

/* ------------------------------------------------------------------ Billing */

export const BILLING_SERVICES = [
  "GST Compliance",
  "Accounting",
  "ITR",
  "TDS",
  "CMA",
  "Audit",
  "ROC",
  "Payroll",
  "DSC",
  "Consulting",
  "Other",
] as const;

export const INVOICE_STATUSES = [
  "Draft",
  "Generated",
  "Sent",
  "Partially Paid",
  "Paid",
  "Overdue",
  "Cancelled",
] as const;

export const BILLING_FREQUENCIES = ["Monthly", "Quarterly", "Yearly", "Custom"] as const;

export const recurringBills = sqliteTable(
  "recurring_bills",
  {
    id: id(),
    firmId: firmId(),
    clientId: text("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    frequency: text("frequency", { enum: BILLING_FREQUENCIES }).notNull().default("Monthly"),
    intervalMonths: integer("interval_months").notNull().default(1),
    /** First day of the next period to bill, e.g. "2026-10-01". */
    nextPeriodStart: text("next_period_start").notNull(),
    dueDays: integer("due_days").notNull().default(15),
    gstRate: integer("gst_rate").notNull().default(18),
    notes: text("notes"),
    ...audit,
  },
  (t) => [index("recurring_firm_idx").on(t.firmId), uniqueIndex("recurring_client_uq").on(t.clientId)],
);

export const recurringBillItems = sqliteTable("recurring_bill_items", {
  id: id(),
  firmId: firmId(),
  recurringBillId: text("recurring_bill_id")
    .notNull()
    .references(() => recurringBills.id, { onDelete: "cascade" }),
  service: text("service", { enum: BILLING_SERVICES }).notNull(),
  description: text("description"),
  amount: integer("amount").notNull(), // paise
  sortOrder: integer("sort_order").notNull().default(0),
  ...audit,
});

export const invoices = sqliteTable(
  "invoices",
  {
    id: id(),
    firmId: firmId(),
    clientId: text("client_id").notNull().references(() => clients.id, { onDelete: "restrict" }),
    number: text("number").notNull(),
    invoiceDate: text("invoice_date").notNull(),
    dueDate: text("due_date").notNull(),
    /** Billing period label key, e.g. "2026-09" (month) or "2026-Q2"/free text. */
    billingPeriod: text("billing_period"),
    /** Stored lifecycle status. "Overdue" / "Partially Paid" / "Paid" are derived at read-time from payments. */
    status: text("status", { enum: INVOICE_STATUSES }).notNull().default("Draft"),
    subtotal: integer("subtotal").notNull(),
    discount: integer("discount").notNull().default(0),
    gstRate: integer("gst_rate").notNull().default(18),
    gstAmount: integer("gst_amount").notNull(),
    total: integer("total").notNull(),
    notes: text("notes"),
    recurringBillId: text("recurring_bill_id").references(() => recurringBills.id, { onDelete: "set null" }),
    sentAt: text("sent_at"),
    sentVia: text("sent_via"),
    ...audit,
  },
  (t) => [
    index("invoices_firm_idx").on(t.firmId),
    index("invoices_client_idx").on(t.clientId),
    uniqueIndex("invoices_firm_number_uq").on(t.firmId, t.number),
    uniqueIndex("invoices_recurring_period_uq").on(t.recurringBillId, t.billingPeriod),
  ],
);

export const invoiceItems = sqliteTable("invoice_items", {
  id: id(),
  firmId: firmId(),
  invoiceId: text("invoice_id").notNull().references(() => invoices.id, { onDelete: "cascade" }),
  service: text("service", { enum: BILLING_SERVICES }).notNull(),
  description: text("description"),
  amount: integer("amount").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  ...audit,
});

export const PAYMENT_MODES = ["Cash", "Bank", "UPI", "Cheque", "NEFT", "RTGS", "Other"] as const;

export const payments = sqliteTable(
  "payments",
  {
    id: id(),
    firmId: firmId(),
    clientId: text("client_id").notNull().references(() => clients.id, { onDelete: "restrict" }),
    invoiceId: text("invoice_id").references(() => invoices.id, { onDelete: "set null" }),
    paymentDate: text("payment_date").notNull(),
    amount: integer("amount").notNull(),
    mode: text("mode", { enum: PAYMENT_MODES }).notNull(),
    reference: text("reference"),
    notes: text("notes"),
    ...audit,
  },
  (t) => [index("payments_firm_idx").on(t.firmId), index("payments_invoice_idx").on(t.invoiceId)],
);

/* ------------------------------------------------------------------ Compliance */

export const COMPLIANCE_CATEGORIES = ["GST", "ITR", "TDS", "CMA", "ROC", "Audit", "Other"] as const;
export const COMPLIANCE_STATUSES = [
  "Not Started",
  "Documents Pending",
  "In Process",
  "Review",
  "Completed",
  "Filed",
] as const;
export const PRIORITIES = ["Low", "Medium", "High", "Critical"] as const;

/** Editable master list of compliance work types. Default due day is user data, not statute. */
export const complianceTypes = sqliteTable(
  "compliance_types",
  {
    id: id(),
    firmId: firmId(),
    category: text("category", { enum: COMPLIANCE_CATEGORIES }).notNull(),
    name: text("name").notNull(),
    periodicity: text("periodicity").notNull().default("Monthly"), // Monthly / Quarterly / Yearly / One-time
    defaultDueDay: integer("default_due_day"), // day of the following month, editable; null = set per task
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    ...audit,
  },
  (t) => [uniqueIndex("compliance_types_uq").on(t.firmId, t.category, t.name)],
);

export const complianceTasks = sqliteTable(
  "compliance_tasks",
  {
    id: id(),
    firmId: firmId(),
    clientId: text("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
    category: text("category", { enum: COMPLIANCE_CATEGORIES }).notNull(),
    complianceType: text("compliance_type").notNull(),
    period: text("period").notNull(), // "Sep 2026", "Q2", "AY 2026-27"
    financialYear: text("financial_year").notNull(), // "2026-27"
    dueDate: text("due_date").notNull(),
    assignedTo: text("assigned_to").references(() => users.id, { onDelete: "set null" }),
    priority: text("priority", { enum: PRIORITIES }).notNull().default("Medium"),
    status: text("status", { enum: COMPLIANCE_STATUSES }).notNull().default("Not Started"),
    filedDate: text("filed_date"),
    acknowledgement: text("acknowledgement"),
    notes: text("notes"),
    ...audit,
  },
  (t) => [
    index("compliance_firm_idx").on(t.firmId),
    index("compliance_client_idx").on(t.clientId),
    index("compliance_due_idx").on(t.dueDate),
  ],
);

/* ------------------------------------------------------------------ Documents */

export const DOCUMENT_STATUSES = ["Received", "Partial", "Pending", "Not Required"] as const;

/** A document request/checklist, e.g. "ABC Traders — September 2026 GST". */
export const documentChecklists = sqliteTable(
  "document_checklists",
  {
    id: id(),
    firmId: firmId(),
    clientId: text("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    period: text("period"),
    category: text("category", { enum: COMPLIANCE_CATEGORIES }).notNull().default("GST"),
    complianceTaskId: text("compliance_task_id").references(() => complianceTasks.id, { onDelete: "set null" }),
    requestedAt: text("requested_at"),
    dueDate: text("due_date"),
    notes: text("notes"),
    ...audit,
  },
  (t) => [index("doc_checklists_firm_idx").on(t.firmId), index("doc_checklists_client_idx").on(t.clientId)],
);

export const documents = sqliteTable(
  "documents",
  {
    id: id(),
    firmId: firmId(),
    checklistId: text("checklist_id").notNull().references(() => documentChecklists.id, { onDelete: "cascade" }),
    clientId: text("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    status: text("status", { enum: DOCUMENT_STATUSES }).notNull().default("Pending"),
    storageKey: text("storage_key"), // opaque key understood by the storage driver
    fileName: text("file_name"),
    mimeType: text("mime_type"),
    sizeBytes: integer("size_bytes"),
    receivedAt: text("received_at"),
    notes: text("notes"),
    ...audit,
  },
  (t) => [index("documents_checklist_idx").on(t.checklistId), index("documents_client_idx").on(t.clientId)],
);

/* ------------------------------------------------------------------ CMA */

export const CMA_STATUSES = ["Draft", "Data Pending", "In Preparation", "Review", "Final", "Submitted"] as const;

export const cmaRecords = sqliteTable(
  "cma_records",
  {
    id: id(),
    firmId: firmId(),
    clientId: text("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
    financialYear: text("financial_year").notNull(),
    period: text("period").notNull(),
    purpose: text("purpose").notNull(),
    bank: text("bank"),
    loanAmount: integer("loan_amount"),
    status: text("status", { enum: CMA_STATUSES }).notNull().default("Draft"),
    dueDate: text("due_date"),
    assignedTo: text("assigned_to").references(() => users.id, { onDelete: "set null" }),
    /** JSON of CmaInputs (rupees). Ratios are always recomputed from inputs, never stored. */
    inputs: text("inputs").notNull().default("{}"),
    notes: text("notes"),
    reportGeneratedAt: text("report_generated_at"),
    ...audit,
  },
  (t) => [index("cma_firm_idx").on(t.firmId), index("cma_client_idx").on(t.clientId)],
);

/* ------------------------------------------------------------------ Tasks & calendar */

export const TASK_STATUSES = ["Not Started", "In Progress", "Review", "Completed"] as const;
export const TASK_CATEGORIES = [
  "GST",
  "ITR",
  "TDS",
  "Accounting",
  "CMA",
  "Audit",
  "ROC",
  "Billing",
  "Documents",
  "Notice",
  "Client Meeting",
  "Admin",
  "Other",
] as const;

export const tasks = sqliteTable(
  "tasks",
  {
    id: id(),
    firmId: firmId(),
    title: text("title").notNull(),
    clientId: text("client_id").references(() => clients.id, { onDelete: "set null" }),
    category: text("category", { enum: TASK_CATEGORIES }).notNull().default("Other"),
    assignedTo: text("assigned_to").references(() => users.id, { onDelete: "set null" }),
    priority: text("priority", { enum: PRIORITIES }).notNull().default("Medium"),
    dueDate: text("due_date").notNull(),
    status: text("status", { enum: TASK_STATUSES }).notNull().default("Not Started"),
    completedAt: text("completed_at"),
    notes: text("notes"),
    ...audit,
  },
  (t) => [index("tasks_firm_idx").on(t.firmId), index("tasks_assignee_idx").on(t.assignedTo)],
);

export const EVENT_TYPES = ["Client Meeting", "Internal", "Reminder", "Other"] as const;

/** Manually created events. Deadlines from other modules are aggregated into the calendar at read time. */
export const calendarEvents = sqliteTable(
  "calendar_events",
  {
    id: id(),
    firmId: firmId(),
    title: text("title").notNull(),
    type: text("type", { enum: EVENT_TYPES }).notNull().default("Client Meeting"),
    clientId: text("client_id").references(() => clients.id, { onDelete: "set null" }),
    date: text("date").notNull(),
    startTime: text("start_time"),
    endTime: text("end_time"),
    location: text("location"),
    notes: text("notes"),
    ...audit,
  },
  (t) => [index("events_firm_date_idx").on(t.firmId, t.date)],
);

/* ------------------------------------------------------------------ Notices & DSC */

export const NOTICE_STATUSES = ["New", "In Progress", "Reply Prepared", "Reply Submitted", "Closed"] as const;
export const DEPARTMENTS = ["GST", "Income Tax", "TDS", "ROC / MCA", "Other"] as const;

export const notices = sqliteTable(
  "notices",
  {
    id: id(),
    firmId: firmId(),
    clientId: text("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
    department: text("department", { enum: DEPARTMENTS }).notNull(),
    noticeType: text("notice_type").notNull(),
    section: text("section"),
    noticeDate: text("notice_date").notNull(),
    dueDate: text("due_date"),
    reference: text("reference"),
    assignedTo: text("assigned_to").references(() => users.id, { onDelete: "set null" }),
    status: text("status", { enum: NOTICE_STATUSES }).notNull().default("New"),
    responseDate: text("response_date"),
    notes: text("notes"),
    ...audit,
  },
  (t) => [index("notices_firm_idx").on(t.firmId)],
);

export const DSC_RENEWAL_STATUSES = ["Active", "Renewal Due", "Renewal In Process", "Renewed", "Expired"] as const;

export const dscRecords = sqliteTable(
  "dsc_records",
  {
    id: id(),
    firmId: firmId(),
    clientId: text("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
    holderName: text("holder_name").notNull(),
    dscClass: text("dsc_class").default("Class 3"),
    issueDate: text("issue_date").notNull(),
    expiryDate: text("expiry_date").notNull(),
    renewalStatus: text("renewal_status", { enum: DSC_RENEWAL_STATUSES }).notNull().default("Active"),
    custody: text("custody"), // e.g. "With office", "With client"
    notes: text("notes"),
    ...audit,
  },
  (t) => [index("dsc_firm_idx").on(t.firmId)],
);

/* ------------------------------------------------------------------ Notifications & activity */

export const notifications = sqliteTable(
  "notifications",
  {
    id: id(),
    firmId: firmId(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(), // task, compliance, invoice, document, dsc, cma, notice
    title: text("title").notNull(),
    body: text("body"),
    href: text("href"),
    dedupeKey: text("dedupe_key"),
    readAt: text("read_at"),
    createdAt: text("created_at").notNull().$defaultFn(now),
  },
  (t) => [
    index("notifications_user_idx").on(t.userId),
    uniqueIndex("notifications_dedupe_uq").on(t.userId, t.dedupeKey),
  ],
);

export const activityLogs = sqliteTable(
  "activity_logs",
  {
    id: id(),
    firmId: firmId(),
    userId: text("user_id"),
    clientId: text("client_id"),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    action: text("action").notNull(),
    summary: text("summary").notNull(),
    occurredAt: text("occurred_at").notNull().$defaultFn(now),
  },
  (t) => [index("activity_firm_idx").on(t.firmId, t.occurredAt), index("activity_client_idx").on(t.clientId)],
);
