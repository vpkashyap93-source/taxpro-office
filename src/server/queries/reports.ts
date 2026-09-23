import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { financialYearOf, fyRange, monthLabel, monthsBetween, todayISO } from "@/lib/dates";
import { computeCma, parseCmaInputs } from "@/lib/cma";
import { formatMetric } from "@/lib/format";
import type { AuthContext } from "../auth";
import { listInvoices, listPayments } from "./invoices";
import { isComplianceDone, listCma, listCompliance, listTasks } from "./work";

export const REPORTS = [
  { key: "revenue", label: "Revenue Report", group: "Finance", needs: "billing" },
  { key: "collection", label: "Collection Report", group: "Finance", needs: "payments" },
  { key: "outstanding", label: "Outstanding Report", group: "Finance", needs: "billing" },
  { key: "client-revenue", label: "Client Revenue", group: "Finance", needs: "billing" },
  { key: "service-revenue", label: "Service-wise Revenue", group: "Finance", needs: "billing" },
  { key: "monthly-billing", label: "Monthly Billing", group: "Finance", needs: "billing" },
  { key: "monthly-collection", label: "Monthly Collection", group: "Finance", needs: "payments" },
  { key: "compliance", label: "Compliance Report", group: "Work", needs: "compliance" },
  { key: "pending-work", label: "Pending Work Report", group: "Work", needs: "compliance" },
  { key: "staff", label: "Staff Performance", group: "Work", needs: "tasks" },
  { key: "cma", label: "CMA Report Summary", group: "Work", needs: "cma" },
] as const;
export type ReportKey = (typeof REPORTS)[number]["key"];

export interface ReportFilters {
  from: string;
  to: string;
  fy: string;
  clientId?: string;
  service?: string;
  staffId?: string;
}

export type CellFormat = "text" | "money" | "number" | "percent" | "date";
export interface ReportColumn {
  key: string;
  label: string;
  format: CellFormat;
}
export interface Report {
  key: ReportKey;
  title: string;
  description: string;
  columns: ReportColumn[];
  rows: Record<string, string | number | null>[];
  totals?: Record<string, number>;
  chart?: { kind: "grouped" | "hbar" | "trend"; unit?: "money" | "count"; data: { label: string; values: Record<string, number> }[]; series: { key: string; label: string; color: string }[] };
}

export function defaultFilters(sp: Record<string, string | undefined>): ReportFilters {
  const today = todayISO();
  const fy = sp.fy && /^\d{4}-\d{2}$/.test(sp.fy) ? sp.fy : financialYearOf(today);
  const r = fyRange(fy);
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  return {
    fy,
    from: sp.from && iso.test(sp.from) ? sp.from : r.start,
    to: sp.to && iso.test(sp.to) ? sp.to : r.end < today ? r.end : today,
    clientId: sp.client || undefined,
    service: sp.service || undefined,
    staffId: sp.staff || undefined,
  };
}

const BILLED = { key: "billed", label: "Billed", color: "var(--chart-billed)" };
const COLLECTED = { key: "collected", label: "Collected", color: "var(--chart-collected)" };

export function buildReport(auth: AuthContext, key: ReportKey, f: ReportFilters): Report | null {
  const def = REPORTS.find((r) => r.key === key);
  if (!def || !auth.can(def.needs)) return null;
  const firmId = auth.firm.id;
  const today = todayISO();
  const inv = () =>
    listInvoices(firmId, { from: f.from, to: f.to, clientId: f.clientId, today }).filter((i) => i.storedStatus !== "Draft" && i.storedStatus !== "Cancelled");
  const itemsFor = (ids: string[]) =>
    ids.length
      ? db
          .select({ invoiceId: s.invoiceItems.invoiceId, service: s.invoiceItems.service, amount: s.invoiceItems.amount })
          .from(s.invoiceItems)
          .where(and(eq(s.invoiceItems.firmId, firmId), sql`${s.invoiceItems.invoiceId} in (${sql.join(ids.map((x) => sql`${x}`), sql`, `)})`))
          .all()
      : [];
  const serviceFilter = (invoices: ReturnType<typeof inv>) => {
    if (!f.service) return invoices;
    const ids = new Set(itemsFor(invoices.map((i) => i.id)).filter((it) => it.service === f.service).map((it) => it.invoiceId));
    return invoices.filter((i) => ids.has(i.id));
  };

  switch (key) {
    case "revenue": {
      const rows = serviceFilter(inv());
      return {
        key, title: def.label, description: "Invoices raised in the period (excluding drafts and cancelled).",
        columns: [
          { key: "date", label: "Date", format: "date" }, { key: "number", label: "Invoice No.", format: "text" }, { key: "client", label: "Client", format: "text" },
          { key: "period", label: "Billing Month", format: "text" }, { key: "total", label: "Amount", format: "money" }, { key: "paid", label: "Paid", format: "money" }, { key: "outstanding", label: "Outstanding", format: "money" }, { key: "status", label: "Status", format: "text" },
        ],
        rows: rows.map((i) => ({ date: i.invoiceDate, number: i.number, client: i.clientName, period: i.billingPeriod ? monthLabel(i.billingPeriod.slice(0, 7)) : "", total: i.total, paid: i.paid, outstanding: i.outstanding, status: i.status })),
        totals: { total: rows.reduce((a, i) => a + i.total, 0), paid: rows.reduce((a, i) => a + i.paid, 0), outstanding: rows.reduce((a, i) => a + i.outstanding, 0) },
      };
    }
    case "collection": {
      const rows = listPayments(firmId, { from: f.from, to: f.to, clientId: f.clientId });
      const modes = [...new Set(rows.map((r) => r.mode))].map((m) => ({ label: m, values: { collected: rows.filter((r) => r.mode === m).reduce((a, r) => a + r.amount, 0) } }));
      return {
        key, title: def.label, description: "Payments received in the period.",
        columns: [{ key: "date", label: "Date", format: "date" }, { key: "client", label: "Client", format: "text" }, { key: "invoice", label: "Invoice", format: "text" }, { key: "mode", label: "Mode", format: "text" }, { key: "reference", label: "Reference", format: "text" }, { key: "amount", label: "Amount", format: "money" }],
        rows: rows.map((p) => ({ date: p.paymentDate, client: p.clientName, invoice: p.invoiceNumber ?? "On account", mode: p.mode, reference: p.reference ?? "", amount: p.amount })),
        totals: { amount: rows.reduce((a, p) => a + p.amount, 0) },
        chart: { kind: "hbar", data: modes, series: [COLLECTED] },
      };
    }
    case "outstanding": {
      const rows = listInvoices(firmId, { clientId: f.clientId, today }).filter((i) => i.outstanding > 0 && i.invoiceDate <= f.to);
      const age = (d: string) => Math.max(0, Math.round((Date.parse(today) - Date.parse(d)) / 86_400_000));
      const bucket = (d: string) => { const a = age(d); return a <= 0 ? "Not due" : a <= 30 ? "1–30 days" : a <= 60 ? "31–60 days" : a <= 90 ? "61–90 days" : "90+ days"; };
      const buckets = ["Not due", "1–30 days", "31–60 days", "61–90 days", "90+ days"].map((b) => ({ label: b, values: { outstanding: rows.filter((r) => bucket(r.dueDate) === b).reduce((a, r) => a + r.outstanding, 0) } }));
      return {
        key, title: def.label, description: `Unpaid balances as on ${f.to}, with ageing from the due date.`,
        columns: [{ key: "client", label: "Client", format: "text" }, { key: "number", label: "Invoice No.", format: "text" }, { key: "date", label: "Invoice Date", format: "date" }, { key: "due", label: "Due Date", format: "date" }, { key: "age", label: "Ageing", format: "text" }, { key: "total", label: "Amount", format: "money" }, { key: "outstanding", label: "Outstanding", format: "money" }],
        rows: rows.sort((a, b) => a.dueDate.localeCompare(b.dueDate)).map((i) => ({ client: i.clientName, number: i.number, date: i.invoiceDate, due: i.dueDate, age: bucket(i.dueDate), total: i.total, outstanding: i.outstanding })),
        totals: { total: rows.reduce((a, i) => a + i.total, 0), outstanding: rows.reduce((a, i) => a + i.outstanding, 0) },
        chart: { kind: "hbar", data: buckets, series: [{ key: "outstanding", label: "Outstanding", color: "var(--chart-billed)" }] },
      };
    }
    case "client-revenue": {
      const rows = serviceFilter(inv());
      const map = new Map<string, { client: string; invoices: number; billed: number; paid: number; outstanding: number }>();
      for (const i of rows) {
        const e = map.get(i.clientId) ?? { client: i.clientName, invoices: 0, billed: 0, paid: 0, outstanding: 0 };
        e.invoices++; e.billed += i.total; e.paid += i.paid; e.outstanding += i.outstanding;
        map.set(i.clientId, e);
      }
      const list = [...map.values()].sort((a, b) => b.billed - a.billed);
      return {
        key, title: def.label, description: "Billing and collection per client for the period.",
        columns: [{ key: "client", label: "Client", format: "text" }, { key: "invoices", label: "Invoices", format: "number" }, { key: "billed", label: "Billed", format: "money" }, { key: "paid", label: "Collected", format: "money" }, { key: "outstanding", label: "Outstanding", format: "money" }],
        rows: list,
        totals: { invoices: list.reduce((a, r) => a + r.invoices, 0), billed: list.reduce((a, r) => a + r.billed, 0), paid: list.reduce((a, r) => a + r.paid, 0), outstanding: list.reduce((a, r) => a + r.outstanding, 0) },
        chart: { kind: "hbar", data: list.slice(0, 10).map((r) => ({ label: r.client, values: { billed: r.billed } })), series: [BILLED] },
      };
    }
    case "service-revenue": {
      const invoices = inv();
      const items = itemsFor(invoices.map((i) => i.id));
      const map = new Map<string, number>();
      for (const it of items) if (!f.service || it.service === f.service) map.set(it.service, (map.get(it.service) ?? 0) + it.amount);
      const total = [...map.values()].reduce((a, b) => a + b, 0);
      const list = [...map.entries()].sort((a, b) => b[1] - a[1]).map(([service, amount]) => ({ service, amount, share: total ? Math.round((amount / total) * 1000) / 10 : 0 }));
      return {
        key, title: def.label, description: "Professional fees by service (before GST).",
        columns: [{ key: "service", label: "Service", format: "text" }, { key: "amount", label: "Fees (excl. GST)", format: "money" }, { key: "share", label: "Share", format: "percent" }],
        rows: list, totals: { amount: total },
        chart: { kind: "hbar", data: list.map((r) => ({ label: r.service, values: { billed: r.amount } })), series: [BILLED] },
      };
    }
    case "monthly-billing":
    case "monthly-collection": {
      const months = monthsBetween(f.from, f.to);
      const invoices = serviceFilter(inv());
      const pays = listPayments(firmId, { from: f.from, to: f.to, clientId: f.clientId });
      const data = months.map((m) => ({ month: m, billed: invoices.filter((i) => i.invoiceDate.startsWith(m)).reduce((a, i) => a + i.total, 0), collected: pays.filter((p) => p.paymentDate.startsWith(m)).reduce((a, p) => a + p.amount, 0), invoices: invoices.filter((i) => i.invoiceDate.startsWith(m)).length, receipts: pays.filter((p) => p.paymentDate.startsWith(m)).length }));
      const billing = key === "monthly-billing";
      return {
        key, title: def.label, description: billing ? "Invoices raised per month." : "Receipts per month.",
        columns: billing
          ? [{ key: "month", label: "Month", format: "text" }, { key: "invoices", label: "Invoices", format: "number" }, { key: "billed", label: "Billed", format: "money" }, { key: "collected", label: "Collected", format: "money" }]
          : [{ key: "month", label: "Month", format: "text" }, { key: "receipts", label: "Receipts", format: "number" }, { key: "collected", label: "Collected", format: "money" }, { key: "billed", label: "Billed", format: "money" }],
        rows: data.map((d) => ({ ...d, month: monthLabel(d.month, "long") })),
        totals: { invoices: data.reduce((a, d) => a + d.invoices, 0), receipts: data.reduce((a, d) => a + d.receipts, 0), billed: data.reduce((a, d) => a + d.billed, 0), collected: data.reduce((a, d) => a + d.collected, 0) },
        chart: { kind: "grouped", data: data.map((d) => ({ label: monthLabel(d.month).split(" ")[0]!, values: { billed: d.billed, collected: d.collected } })), series: billing ? [BILLED, COLLECTED] : [COLLECTED, BILLED] },
      };
    }
    case "compliance": {
      const rows = listCompliance(firmId, { from: f.from, to: f.to, clientId: f.clientId, category: f.service, assignedTo: f.staffId });
      const cats = [...new Set(rows.map((r) => r.category))];
      return {
        key, title: def.label, description: "Compliance items due in the period and their status.",
        columns: [{ key: "client", label: "Client", format: "text" }, { key: "type", label: "Compliance", format: "text" }, { key: "period", label: "Period", format: "text" }, { key: "due", label: "Due Date", format: "date" }, { key: "status", label: "Status", format: "text" }, { key: "filed", label: "Filed On", format: "date" }, { key: "staff", label: "Assigned To", format: "text" }],
        rows: rows.map((r) => ({ client: r.clientName, type: r.complianceType, period: r.period, due: r.dueDate, status: r.status, filed: r.filedDate, staff: r.assigneeName ?? "" })),
        chart: { kind: "grouped", unit: "count", data: cats.map((c) => ({ label: c, values: { done: rows.filter((r) => r.category === c && isComplianceDone(r.status)).length, open: rows.filter((r) => r.category === c && !isComplianceDone(r.status)).length } })), series: [{ key: "done", label: "Completed / Filed", color: "var(--chart-collected)" }, { key: "open", label: "Open", color: "var(--chart-billed)" }] },
      };
    }
    case "pending-work": {
      const rows = listCompliance(firmId, { clientId: f.clientId, category: f.service, assignedTo: f.staffId }).filter((r) => !isComplianceDone(r.status) && r.dueDate <= f.to);
      return {
        key, title: def.label, description: `Open compliance work due on or before ${f.to}, oldest first.`,
        columns: [{ key: "client", label: "Client", format: "text" }, { key: "type", label: "Compliance", format: "text" }, { key: "period", label: "Period", format: "text" }, { key: "due", label: "Due Date", format: "date" }, { key: "overdue", label: "Days Overdue", format: "number" }, { key: "status", label: "Status", format: "text" }, { key: "staff", label: "Assigned To", format: "text" }],
        rows: rows.map((r) => ({ client: r.clientName, type: r.complianceType, period: r.period, due: r.dueDate, overdue: Math.max(0, Math.round((Date.parse(today) - Date.parse(r.dueDate)) / 86_400_000)), status: r.status, staff: r.assigneeName ?? "Unassigned" })),
      };
    }
    case "staff": {
      const staff = db.select({ id: s.users.id, name: s.users.name, role: s.users.role }).from(s.users).where(and(eq(s.users.firmId, firmId), sql`${s.users.role} != 'Client'`)).all().filter((u) => !f.staffId || u.id === f.staffId);
      const comp = listCompliance(firmId, { from: f.from, to: f.to });
      const tasks = listTasks(firmId).filter((t) => t.dueDate >= f.from && t.dueDate <= f.to);
      const list = staff.map((u) => {
        const c = comp.filter((x) => x.assignedTo === u.id);
        const t = tasks.filter((x) => x.assignedTo === u.id);
        const done = c.filter((x) => isComplianceDone(x.status)).length + t.filter((x) => x.status === "Completed").length;
        const onTime = c.filter((x) => isComplianceDone(x.status) && x.filedDate && x.filedDate <= x.dueDate).length;
        const total = c.length + t.length;
        return { name: u.name, role: u.role, assigned: total, completed: done, onTime, overdue: [...c.filter((x) => !isComplianceDone(x.status)), ...t.filter((x) => x.status !== "Completed")].filter((x) => x.dueDate < today).length, rate: total ? Math.round((done / total) * 1000) / 10 : 0 };
      });
      return {
        key, title: def.label, description: "Compliance items and tasks due in the period, per team member.",
        columns: [{ key: "name", label: "Staff", format: "text" }, { key: "role", label: "Role", format: "text" }, { key: "assigned", label: "Assigned", format: "number" }, { key: "completed", label: "Completed", format: "number" }, { key: "onTime", label: "Filed on time", format: "number" }, { key: "overdue", label: "Overdue", format: "number" }, { key: "rate", label: "Completion", format: "percent" }],
        rows: list,
      };
    }
    case "cma": {
      const rows = listCma(firmId, { clientId: f.clientId });
      return {
        key, title: def.label, description: "All CMA cases with headline ratios.",
        columns: [{ key: "client", label: "Client", format: "text" }, { key: "purpose", label: "Purpose", format: "text" }, { key: "bank", label: "Bank", format: "text" }, { key: "limit", label: "Limit", format: "money" }, { key: "cr", label: "Current Ratio", format: "text" }, { key: "dscr", label: "DSCR", format: "text" }, { key: "de", label: "Debt/Equity", format: "text" }, { key: "status", label: "Status", format: "text" }],
        rows: rows.map((r) => {
          const m = computeCma(parseCmaInputs(r.inputs));
          const g = (k: string) => { const x = m.find((y) => y.key === k)!; return formatMetric(x.value, x.format); };
          return { client: r.clientName, purpose: r.purpose, bank: r.bank ?? "", limit: r.loanAmount ?? 0, cr: g("currentRatio"), dscr: g("dscr"), de: g("debtEquity"), status: r.status };
        }),
      };
    }
  }
}

export function toCsv(r: Report): string {
  const esc = (v: unknown) => {
    const t = v === null || v === undefined ? "" : String(v);
    const safe = /^[=+\-@]/.test(t) ? `'${t}` : t; // neutralise spreadsheet formula injection
    return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  const fmt = (c: ReportColumn, v: string | number | null) => (c.format === "money" && typeof v === "number" ? (v / 100).toFixed(2) : v);
  const lines = [r.columns.map((c) => esc(c.label)).join(",")];
  for (const row of r.rows) lines.push(r.columns.map((c) => esc(fmt(c, row[c.key] ?? null))).join(","));
  if (r.totals) lines.push(r.columns.map((c, i) => (i === 0 ? "Total" : c.key in r.totals! ? esc(fmt(c, r.totals![c.key]!)) : "")).join(","));
  return lines.join("\r\n");
}
