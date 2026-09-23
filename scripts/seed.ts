/**
 * Demo data seed. All dates are generated relative to "today" (IST) so the demo always looks current.
 *
 *   npm run db:seed     → seeds only if the database has no firm yet
 *   npm run db:reset    → wipes ./data and seeds fresh
 */
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import fs from "node:fs";
import path from "node:path";
import * as s from "../src/db/schema";
import { addDays, addMonths, financialYearOf, fyRange, monthLabel, startOfMonth, todayISO } from "../src/lib/dates";
import { computeInvoiceTotals, toPaise } from "../src/lib/money";
import { buildGstin } from "../src/lib/identifiers";
import { formatInvoiceNumber } from "../src/lib/invoices";
import { periodKey } from "../src/lib/recurring";
import { LocalStorageDriver } from "../src/server/storage/local";

const DB_FILE = path.resolve(process.env.DATABASE_PATH ?? "./data/taxpro.db");
const UPLOADS = path.resolve(process.env.STORAGE_LOCAL_DIR ?? "./data/uploads");

fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
const sqlite = new Database(DB_FILE);
sqlite.pragma("foreign_keys = ON");
const db = drizzle(sqlite, { schema: s });
migrate(db, { migrationsFolder: path.resolve("./drizzle") });

const force = process.argv.includes("--force");
if (db.select().from(s.firms).all().length > 0 && !force) {
  console.log("Database already seeded — skipping. Use `npm run db:reset` for a fresh demo.");
  process.exit(0);
}

/* -------------------------------------------------------------- deterministic randomness */
let seed = 20260923;
const rand = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};
const pick = <T>(arr: readonly T[]) => arr[Math.floor(rand() * arr.length)]!;
const between = (a: number, b: number) => a + Math.floor(rand() * (b - a + 1));

const T = todayISO();
const FY = financialYearOf(T);
const fy = fyRange(FY);
const thisMonth = startOfMonth(T);
const lastMonth = addMonths(thisMonth, -1);
const lastMonthLabel = monthLabel(lastMonth, "long");

async function main() {
  const password = process.env.SEED_DEMO_PASSWORD ?? "TaxPro@2026";
  const hash = await bcrypt.hash(password, 12);

  /* ------------------------------------------------------------ firm & staff */
  const [firm] = db
    .insert(s.firms)
    .values({
      name: "VK Tax Consultants",
      legalName: "VK Tax Consultants",
      gstin: buildGstin("03", "AKZPK4821M"),
      pan: "AKZPK4821M",
      email: "office@vktax.in",
      phone: "9814012345",
      address: "SCO 21, Feroze Gandhi Market, Ludhiana, Punjab 141001",
      state: "Punjab",
    })
    .returning()
    .all();
  const F = firm!.id;

  const staffSeed = [
    { name: "Varinder Kashyap", email: "varinder@taxpro.demo", role: "Admin", designation: "Proprietor · Tax Consultant", phone: "9814012345" },
    { name: "Rahul Verma", email: "rahul@taxpro.demo", role: "Senior", designation: "Senior Associate", phone: "9876011122" },
    { name: "Amit Sharma", email: "amit@taxpro.demo", role: "Junior", designation: "Article Assistant", phone: "9876022233" },
    { name: "Neha Gupta", email: "neha@taxpro.demo", role: "Junior", designation: "Accounts Executive", phone: "9876033344" },
    { name: "Pooja Arora", email: "pooja@taxpro.demo", role: "Billing Staff", designation: "Billing & Collections", phone: "9876044455" },
  ] as const;
  const staff = db
    .insert(s.users)
    .values(staffSeed.map((u) => ({ ...u, firmId: F, passwordHash: hash })))
    .returning()
    .all();
  const U = Object.fromEntries(staff.map((u) => [u.name.split(" ")[0], u.id])) as Record<string, string>;
  const ADMIN = U.Varinder!;
  const by = { createdBy: ADMIN, updatedBy: ADMIN };

  /* ------------------------------------------------------------ settings */
  const settingsRows: { key: string; value: unknown }[] = [
    {
      key: "bank",
      value: { accountName: "VK Tax Consultants", bankName: "Punjab National Bank", accountNumber: "0123002100045678", ifsc: "PUNB0012300", upiId: "vktax@pnb" },
    },
  ];

  /* ------------------------------------------------------------ compliance types master (editable data) */
  const types: { category: (typeof s.COMPLIANCE_CATEGORIES)[number]; name: string; periodicity: string; defaultDueDay: number | null }[] = [
    { category: "GST", name: "GSTR-1", periodicity: "Monthly", defaultDueDay: 11 },
    { category: "GST", name: "GSTR-3B", periodicity: "Monthly", defaultDueDay: 20 },
    { category: "GST", name: "GSTR-2B Reconciliation", periodicity: "Monthly", defaultDueDay: 14 },
    { category: "GST", name: "GSTR-9 Annual Return", periodicity: "Yearly", defaultDueDay: null },
    { category: "GST", name: "Other GST Work", periodicity: "One-time", defaultDueDay: null },
    ...["ITR-1", "ITR-2", "ITR-3", "ITR-4", "ITR-5", "ITR-6"].map((name) => ({ category: "ITR" as const, name, periodicity: "Yearly", defaultDueDay: null })),
    { category: "TDS", name: "24Q", periodicity: "Quarterly", defaultDueDay: 31 },
    { category: "TDS", name: "26Q", periodicity: "Quarterly", defaultDueDay: 31 },
    { category: "TDS", name: "27Q", periodicity: "Quarterly", defaultDueDay: 31 },
    { category: "TDS", name: "TDS Payment", periodicity: "Monthly", defaultDueDay: 7 },
    { category: "TDS", name: "Other TDS Work", periodicity: "One-time", defaultDueDay: null },
    { category: "CMA", name: "CMA Report", periodicity: "One-time", defaultDueDay: null },
    { category: "ROC", name: "AOC-4", periodicity: "Yearly", defaultDueDay: null },
    { category: "ROC", name: "MGT-7A", periodicity: "Yearly", defaultDueDay: null },
    { category: "ROC", name: "DIR-3 KYC", periodicity: "Yearly", defaultDueDay: null },
    { category: "ROC", name: "LLP Form 11", periodicity: "Yearly", defaultDueDay: null },
    { category: "Audit", name: "Tax Audit (3CB-3CD)", periodicity: "Yearly", defaultDueDay: null },
    { category: "Audit", name: "Statutory Audit", periodicity: "Yearly", defaultDueDay: null },
    { category: "Other", name: "Other Compliance", periodicity: "One-time", defaultDueDay: null },
  ];
  db.insert(s.complianceTypes).values(types.map((t) => ({ ...t, firmId: F, ...by }))).run();

  /* ------------------------------------------------------------ clients */
  type C = {
    name: string; trade?: string; pan: string; state?: string; city: string; constitution: string; businessType: string;
    services: (typeof s.SERVICES)[number][]; status?: (typeof s.CLIENT_STATUSES)[number]; tan?: string; udyam?: string;
    gst?: boolean; manager: string; recurring?: [(typeof s.BILLING_SERVICES)[number], number][]; freq?: "Monthly" | "Quarterly";
  };
  const clientSeed: C[] = [
    { name: "ABC Traders", trade: "ABC Traders", pan: "AAKFA3121K", city: "Ludhiana", constitution: "Partnership Firm", businessType: "Wholesale", services: ["GST", "Accounting", "TDS", "ITR"], gst: true, tan: "JLDA01234B", manager: "Rahul", recurring: [["Accounting", 3000], ["GST Compliance", 1000], ["TDS", 500]] },
    { name: "Sharma & Co", trade: "Sharma & Co", pan: "AAPFS7612Q", city: "Ludhiana", constitution: "Partnership Firm", businessType: "Trading", services: ["GST", "Accounting", "CMA", "ITR"], gst: true, manager: "Amit", recurring: [["Accounting", 4000], ["GST Compliance", 1500]] },
    { name: "XYZ Industries Pvt Ltd", trade: "XYZ Ltd", pan: "AABCX4410H", city: "Jalandhar", constitution: "Private Limited Company", businessType: "Manufacturing", services: ["GST", "TDS", "Accounting", "ROC", "Audit", "Payroll"], gst: true, tan: "JLDX04567C", udyam: "UDYAM-PB-07-0012345", manager: "Rahul", recurring: [["Accounting", 8000], ["GST Compliance", 2500], ["TDS", 1500], ["Payroll", 2000]] },
    { name: "Gupta Electronics", pan: "BQGPG5521L", city: "Ludhiana", constitution: "Proprietorship", businessType: "Retail", services: ["GST", "ITR", "Accounting"], gst: true, manager: "Neha", recurring: [["Accounting", 2000], ["GST Compliance", 1000]] },
    { name: "Singh Auto Parts", pan: "CDSPS8813M", city: "Khanna", constitution: "Proprietorship", businessType: "Trading", services: ["GST", "ITR"], gst: true, manager: "Amit", recurring: [["GST Compliance", 1500]] },
    { name: "Mehta Textiles LLP", trade: "Mehta Textiles", pan: "AAQFM2290D", city: "Ludhiana", constitution: "LLP", businessType: "Manufacturing", services: ["GST", "TDS", "Accounting", "ROC", "CMA", "Audit"], gst: true, tan: "JLDM07788E", udyam: "UDYAM-PB-07-0045678", manager: "Rahul", recurring: [["Accounting", 6000], ["GST Compliance", 2000], ["TDS", 1000]] },
    { name: "Bansal Pharma Distributors", trade: "Bansal Pharma", pan: "AKBPB6612R", city: "Ludhiana", constitution: "Proprietorship", businessType: "Wholesale", services: ["GST", "Accounting", "ITR", "TDS"], gst: true, manager: "Neha", recurring: [["Accounting", 3500], ["GST Compliance", 1500], ["TDS", 500]] },
    { name: "Kapoor Constructions Pvt Ltd", trade: "Kapoor Constructions", pan: "AADCK9087F", city: "Mohali", constitution: "Private Limited Company", businessType: "Contractor", services: ["GST", "TDS", "ROC", "Audit", "Accounting", "DSC"], gst: true, tan: "PTLK02211A", manager: "Rahul", recurring: [["Accounting", 7000], ["GST Compliance", 2500], ["TDS", 1500]] },
    { name: "Malhotra Foods", trade: "Malhotra Sweets & Bakers", pan: "BNMPM3345K", city: "Ludhiana", constitution: "Proprietorship", businessType: "Retail", services: ["GST", "ITR", "Accounting"], gst: true, manager: "Amit", recurring: [["Accounting", 2500], ["GST Compliance", 1000]] },
    { name: "Arora Hardware Store", pan: "AFRPA1209G", city: "Ludhiana", constitution: "Proprietorship", businessType: "Retail", services: ["GST", "ITR"], gst: true, manager: "Neha", recurring: [["GST Compliance", 3000]], freq: "Quarterly" },
    { name: "Dhillon Agro Industries", trade: "Dhillon Agro", pan: "AAJFD7788P", city: "Moga", constitution: "Partnership Firm", businessType: "Manufacturing", services: ["GST", "CMA", "Accounting", "ITR", "Audit"], gst: true, manager: "Rahul", recurring: [["Accounting", 4500], ["GST Compliance", 1500]] },
    { name: "Sethi Jewellers", pan: "CHSPS4521B", city: "Ludhiana", constitution: "Proprietorship", businessType: "Retail", services: ["GST", "ITR", "Accounting", "TDS"], gst: true, manager: "Amit", recurring: [["Accounting", 3000], ["GST Compliance", 1500]] },
    { name: "Dr. Anjali Mehra", pan: "BWXPM6723C", city: "Ludhiana", constitution: "Individual", businessType: "Professional", services: ["ITR", "TDS"], manager: "Neha" },
    { name: "Rajesh Kumar", pan: "DKLPK9911H", city: "Ludhiana", constitution: "Individual", businessType: "Salaried", services: ["ITR"], manager: "Amit" },
    { name: "Punjab Cold Storage LLP", trade: "Punjab Cold Storage", pan: "AASFP5530N", city: "Khanna", constitution: "LLP", businessType: "Services", services: ["GST", "ROC", "CMA", "Accounting", "DSC"], gst: true, manager: "Rahul", recurring: [["Accounting", 3500], ["GST Compliance", 1000]] },
    { name: "Verma Logistics", pan: "AGVPV2231J", city: "Ludhiana", constitution: "Proprietorship", businessType: "Services", services: ["GST", "TDS", "ITR"], gst: true, manager: "Neha", recurring: [["GST Compliance", 1500], ["TDS", 750]] },
    { name: "Grewal Motors", pan: "AAIFG6655E", city: "Jagraon", constitution: "Partnership Firm", businessType: "Trading", services: ["GST", "ITR", "Audit"], gst: true, manager: "Amit", status: "On Hold" },
    { name: "Chopra Furnishings", pan: "BZCPC4410A", city: "Ludhiana", constitution: "Proprietorship", businessType: "Retail", services: ["GST"], manager: "Rahul", status: "Prospect" },
    { name: "Jain Enterprises", pan: "AHJPJ7702D", city: "Ludhiana", constitution: "Proprietorship", businessType: "Trading", services: ["GST", "ITR"], gst: true, manager: "Neha", status: "Inactive" },
  ];

  const mobiles = ["98140", "98721", "98150", "94170", "99150", "98888", "97800", "98555"];
  const clients = clientSeed.map((c, i) => {
    const slug = c.name.toLowerCase().replace(/[^a-z]+/g, "").slice(0, 12);
    const row = db
      .insert(s.clients)
      .values({
        firmId: F,
        code: `CL-${String(i + 1).padStart(3, "0")}`,
        name: c.name,
        tradeName: c.trade ?? null,
        mobile: `${pick(mobiles)}${String(between(10000, 99999))}`,
        email: `accounts@${slug}.in`,
        address: `${between(1, 250)}, ${pick(["Industrial Area-A", "Ghumar Mandi", "Model Town", "Focal Point", "Civil Lines", "Sarabha Nagar", "Grain Market"])}`,
        city: c.city,
        state: c.state ?? "Punjab",
        pan: c.pan,
        gstin: c.gst ? buildGstin("03", c.pan) : null,
        tan: c.tan ?? null,
        udyam: c.udyam ?? null,
        businessType: c.businessType,
        constitution: c.constitution,
        financialYear: FY,
        status: c.status ?? "Active",
        managerId: U[c.manager],
        notes: i === 0 ? "Prefers WhatsApp for reminders. Sales data usually arrives by the 5th." : null,
        createdAt: new Date(Date.now() - (400 - i * 10) * 86_400_000).toISOString(),
        ...by,
      })
      .returning()
      .get();
    db.insert(s.clientServices).values(c.services.map((service) => ({ firmId: F, clientId: row.id, service, ...by }))).run();
    return { ...row, seed: c };
  });
  const byName = (n: string) => clients.find((c) => c.name.startsWith(n))!;

  /* ------------------------------------------------------------ recurring plans */
  const plans = clients
    .filter((c) => c.seed.recurring && c.status === "Active")
    .map((c) => {
      const interval = c.seed.freq === "Quarterly" ? 3 : 1;
      const plan = db
        .insert(s.recurringBills)
        .values({
          firmId: F,
          clientId: c.id,
          frequency: c.seed.freq ?? "Monthly",
          intervalMonths: interval,
          nextPeriodStart: fy.start, // advanced below as invoices are generated
          dueDays: 15,
          gstRate: 18,
          ...by,
        })
        .returning()
        .get();
      db.insert(s.recurringBillItems)
        .values(c.seed.recurring!.map(([service, amount], idx) => ({ firmId: F, recurringBillId: plan.id, service, amount: toPaise(amount), sortOrder: idx, description: `${service} — professional fees`, ...by })))
        .run();
      return { plan, client: c, interval, items: c.seed.recurring! };
    });

  /* ------------------------------------------------------------ invoices & payments */
  let seq = 1;
  const activity: (typeof s.activityLogs.$inferInsert)[] = [];
  const log = (clientId: string | null, entityType: string, action: string, summary: string, at: string, userId = ADMIN, entityId?: string) =>
    activity.push({ firmId: F, clientId, entityType, action, summary, occurredAt: `${at}T${String(between(4, 12)).padStart(2, "0")}:${String(between(0, 59)).padStart(2, "0")}:00.000Z`, userId, entityId });

  function createInvoice(opts: {
    clientId: string; date: string; items: [(typeof s.BILLING_SERVICES)[number], number, string?][]; period?: string | null;
    recurringId?: string; status: (typeof s.INVOICE_STATUSES)[number]; discount?: number; dueDays?: number;
  }) {
    const amounts = opts.items.map(([, a]) => toPaise(a));
    const totals = computeInvoiceTotals(amounts, toPaise(opts.discount ?? 0), 18);
    const number = formatInvoiceNumber("TPO", financialYearOf(opts.date), seq++);
    const inv = db
      .insert(s.invoices)
      .values({
        firmId: F,
        clientId: opts.clientId,
        number,
        invoiceDate: opts.date,
        dueDate: addDays(opts.date, opts.dueDays ?? 15),
        billingPeriod: opts.period ?? null,
        status: opts.status,
        subtotal: totals.subtotal,
        discount: totals.discount,
        gstRate: 18,
        gstAmount: totals.gstAmount,
        total: totals.total,
        recurringBillId: opts.recurringId ?? null,
        sentAt: opts.status === "Sent" ? `${addDays(opts.date, 1)}T10:00:00.000Z` : null,
        sentVia: opts.status === "Sent" ? pick(["WhatsApp", "Email"]) : null,
        createdAt: `${opts.date}T10:00:00.000Z`,
        ...by,
      })
      .returning()
      .get();
    db.insert(s.invoiceItems)
      .values(opts.items.map(([service, amount, desc], i) => ({ firmId: F, invoiceId: inv.id, service, amount: toPaise(amount), description: desc ?? `${service} — professional fees`, sortOrder: i, ...by })))
      .run();
    log(opts.clientId, "invoice", "created", `Invoice ${number} generated`, opts.date, U.Pooja, inv.id);
    return inv;
  }

  function pay(inv: typeof s.invoices.$inferSelect, amount: number, date: string) {
    if (date > T) return;
    db.insert(s.payments)
      .values({
        firmId: F,
        clientId: inv.clientId,
        invoiceId: inv.id,
        paymentDate: date,
        amount,
        mode: pick(["UPI", "NEFT", "Bank", "Cheque", "UPI", "Cash"] as const),
        reference: `${pick(["UTR", "UPI", "CHQ"])}${between(100000, 999999)}${between(1000, 9999)}`,
        createdAt: `${date}T12:00:00.000Z`,
        createdBy: U.Pooja,
        updatedBy: U.Pooja,
      })
      .run();
    log(inv.clientId, "payment", "received", `Payment of ₹${(amount / 100).toLocaleString("en-IN")} received against ${inv.number}`, date, U.Pooja, inv.id);
  }

  // Monthly recurring invoices: from April of the FY until the current month (invoice raised on the 1st–3rd of the next month).
  const latePayers = new Set([byName("Singh Auto").id, byName("Malhotra").id, byName("Verma Log").id]);
  for (const p of plans) {
    // Start one period before the FY so March fees (billed in April) appear in this year's collections.
    let period = addMonths(fy.start, -p.interval);
    while (true) {
      const invoiceDate = addDays(addMonths(period, p.interval), between(0, 2)); // after the period ends
      if (invoiceDate > T) break;
      const key = periodKey(period, p.interval);
      const inv = createInvoice({
        clientId: p.client.id,
        date: invoiceDate,
        period: key,
        recurringId: p.plan.id,
        status: "Sent",
        items: p.items.map(([svc, amt]) => [svc, amt, `${svc} — ${monthLabel(period, "long")}${p.interval > 1 ? " quarter" : ""}`]),
      });
      const age = Math.round((Date.parse(T) - Date.parse(invoiceDate)) / 86_400_000);
      const isLate = latePayers.has(p.client.id);
      if (age > 45 && !isLate) pay(inv, inv.total, addDays(invoiceDate, between(4, 20)));
      else if (age > 45 && isLate) {
        if (rand() > 0.5) pay(inv, Math.round(inv.total / 200) * 100, addDays(invoiceDate, between(10, 30)));
      } else if (age > 12 && !isLate && rand() > 0.35) pay(inv, inv.total, addDays(invoiceDate, between(3, Math.min(age, 18))));
      else if (age > 12 && rand() > 0.6) pay(inv, Math.round(inv.total / 200) * 100, addDays(invoiceDate, between(3, 10)));
      period = addMonths(period, p.interval);
    }
    db.update(s.recurringBills).set({ nextPeriodStart: period }).where(eq(s.recurringBills.id, p.plan.id)).run();
  }

  // One-off invoices: ITR season, CMA, audit, ROC, consulting.
  const oneOffs: { client: string; offset: number; items: [(typeof s.BILLING_SERVICES)[number], number, string?][]; paid: "full" | "part" | "none"; status?: "Draft" | "Sent" | "Generated" }[] = [
    { client: "Dr. Anjali", offset: -70, items: [["ITR", 5000, `ITR-3 filing — AY ${Number(FY.slice(0, 4))}-${String((Number(FY.slice(0, 4)) + 1) % 100).padStart(2, "0")}`]], paid: "full" },
    { client: "Rajesh Kumar", offset: -68, items: [["ITR", 1500, "ITR-1 filing"]], paid: "full" },
    { client: "Gupta Electronics", offset: -60, items: [["ITR", 3500, "ITR-4 filing"]], paid: "full" },
    { client: "Singh Auto", offset: -58, items: [["ITR", 3500, "ITR-4 filing"]], paid: "none" },
    { client: "Sharma & Co", offset: -40, items: [["CMA", 25000, "CMA data preparation — term loan renewal"]], paid: "part" },
    { client: "Dhillon Agro", offset: -35, items: [["CMA", 30000, "CMA report — CC limit enhancement"], ["Consulting", 5000, "Project report advisory"]], paid: "full" },
    { client: "Kapoor Constructions", offset: -30, items: [["Audit", 45000, "Statutory audit"], ["ROC", 8000, "AOC-4 & MGT-7 filing"]], paid: "none" },
    { client: "Mehta Textiles", offset: -22, items: [["Audit", 35000, "Tax audit u/s 44AB"]], paid: "part" },
    { client: "Punjab Cold", offset: -15, items: [["CMA", 20000, "CMA — working capital assessment"], ["DSC", 1500, "DSC renewal (Class 3)"]], paid: "none" },
    { client: "XYZ Industries", offset: -9, items: [["Audit", 60000, "Statutory audit"], ["ROC", 10000, "Annual ROC filings"]], paid: "part" },
    { client: "Grewal Motors", offset: -95, items: [["Audit", 25000, "Tax audit"]], paid: "part" },
    { client: "Sethi Jewellers", offset: -4, items: [["Consulting", 7500, "GST notice advisory"]], paid: "none", status: "Generated" },
    { client: "Bansal Pharma", offset: -1, items: [["ITR", 6000, "ITR-3 with tax audit reconciliation"]], paid: "none", status: "Draft" },
  ];
  for (const o of oneOffs) {
    const date = addDays(T, o.offset);
    const inv = createInvoice({ clientId: byName(o.client).id, date, items: o.items, status: o.status ?? "Sent", dueDays: 15 });
    if (o.paid === "full") pay(inv, inv.total, addDays(date, between(3, 12)));
    if (o.paid === "part") pay(inv, Math.round(inv.total / 2 / 100) * 100, addDays(date, between(2, Math.max(2, Math.min(-o.offset - 1, 10)))));
  }

  settingsRows.push({
    key: `invoiceSeq:${FY}`,
    value: seq,
  });
  settingsRows.push({
    key: "invoice",
    value: { prefix: "TPO", defaultDueDays: 15, defaultGstRate: 18, sac: "998231", terms: "Payment due within 15 days. Please quote the invoice number with your payment. Bank and UPI details are printed below." },
  });
  db.insert(s.settings).values(settingsRows.map((r) => ({ firmId: F, key: r.key, value: JSON.stringify(r.value), ...by }))).run();

  /* ------------------------------------------------------------ compliance tasks */
  const staffRotation = [U.Rahul!, U.Amit!, U.Neha!];
  const compliance: (typeof s.complianceTasks.$inferInsert)[] = [];
  const gstClients = clients.filter((c) => c.gstin && c.status === "Active");
  const lmLabel = monthLabel(lastMonth);
  gstClients.forEach((c, i) => {
    const assignee = U[c.seed.manager] ?? pick(staffRotation);
    // Previous month GSTR-1: mostly filed.
    const g1Filed = i % 5 !== 3;
    compliance.push({ firmId: F, clientId: c.id, category: "GST", complianceType: "GSTR-1", period: lmLabel, financialYear: FY, dueDate: addDays(T, -12 + (i % 3)), assignedTo: assignee, priority: "High", status: g1Filed ? "Filed" : "In Process", filedDate: g1Filed ? addDays(T, -14 + (i % 3)) : null, acknowledgement: g1Filed ? `AA03${between(1000000, 9999999)}` : null, ...by });
    // Previous month GSTR-3B: spread across today / tomorrow / overdue / filed.
    const slot = i % 6;
    const g3 = [
      { due: T, status: "Pending" as const },
      { due: T, status: "In Process" as const },
      { due: addDays(T, 1), status: "Documents Pending" as const },
      { due: addDays(T, -3), status: "Review" as const },
      { due: addDays(T, -3), status: "Filed" as const },
      { due: addDays(T, 2), status: "Not Started" as const },
    ][slot]!;
    compliance.push({ firmId: F, clientId: c.id, category: "GST", complianceType: "GSTR-3B", period: lmLabel, financialYear: FY, dueDate: g3.due, assignedTo: assignee, priority: slot < 2 ? "Critical" : "High", status: g3.status === "Pending" ? "Not Started" : g3.status, filedDate: g3.status === "Filed" ? addDays(T, -4) : null, notes: slot === 2 ? "Purchase register awaited from client." : null, ...by });
    // Current month GSTR-1 upcoming.
    compliance.push({ firmId: F, clientId: c.id, category: "GST", complianceType: "GSTR-1", period: monthLabel(thisMonth), financialYear: FY, dueDate: addDays(T, 18), assignedTo: assignee, priority: "Medium", status: "Not Started", ...by });
    if (i % 2 === 0) compliance.push({ firmId: F, clientId: c.id, category: "GST", complianceType: "GSTR-2B Reconciliation", period: lmLabel, financialYear: FY, dueDate: addDays(T, 4 + (i % 3)), assignedTo: assignee, priority: "Medium", status: i % 4 === 0 ? "In Process" : "Not Started", ...by });
  });
  const tdsClients = clients.filter((c) => c.seed.services.includes("TDS") && c.status === "Active");
  tdsClients.forEach((c, i) => {
    compliance.push({ firmId: F, clientId: c.id, category: "TDS", complianceType: "TDS Payment", period: lmLabel, financialYear: FY, dueDate: addDays(T, -16), assignedTo: U.Neha, priority: "High", status: "Completed", filedDate: addDays(T, -17), ...by });
    compliance.push({ firmId: F, clientId: c.id, category: "TDS", complianceType: i % 2 ? "24Q" : "26Q", period: "Q2", financialYear: FY, dueDate: addDays(T, i === 0 ? 1 : 5 + i * 3), assignedTo: i % 2 ? U.Rahul : U.Neha, priority: i === 0 ? "High" : "Medium", status: i === 0 ? "In Process" : i % 3 === 0 ? "Documents Pending" : "Not Started", ...by });
  });
  const ay = `AY ${Number(FY.slice(0, 4))}-${String((Number(FY.slice(0, 4)) + 1) % 100).padStart(2, "0")}`;
  const itrMap: [string, string, "Filed" | "Review" | "In Process" | "Documents Pending" | "Not Started", number][] = [
    ["Dr. Anjali", "ITR-3", "Filed", -60], ["Rajesh Kumar", "ITR-1", "Filed", -65], ["Gupta Electronics", "ITR-4", "Filed", -55],
    ["Singh Auto", "ITR-4", "Filed", -55], ["ABC Traders", "ITR-5", "Review", 8], ["Sharma & Co", "ITR-5", "In Process", 8],
    ["Bansal Pharma", "ITR-3", "Documents Pending", 8], ["Malhotra", "ITR-3", "Not Started", 8], ["Dhillon Agro", "ITR-5", "In Process", 8],
    ["Sethi Jewellers", "ITR-3", "Documents Pending", 8], ["Mehta Textiles", "ITR-5", "Review", 8], ["XYZ Industries", "ITR-6", "In Process", 38],
    ["Kapoor Constructions", "ITR-6", "Not Started", 38], ["Verma Logistics", "ITR-4", "Filed", -50], ["Arora Hardware", "ITR-4", "Filed", -52],
  ];
  itrMap.forEach(([n, form, status, off], i) => {
    compliance.push({ firmId: F, clientId: byName(n).id, category: "ITR", complianceType: form, period: ay, financialYear: FY, dueDate: addDays(T, off), assignedTo: staffRotation[i % 3], priority: off > 0 && off < 10 ? "High" : "Medium", status, filedDate: status === "Filed" ? addDays(T, off - 2) : null, acknowledgement: status === "Filed" ? `${between(100000000, 999999999)}${between(100000, 999999)}` : null, ...by });
  });
  const audits: [string, string, string, number, "In Process" | "Review" | "Not Started" | "Completed"][] = [
    ["Mehta Textiles", "Audit", "Tax Audit (3CB-3CD)", 6, "Review"], ["Kapoor Constructions", "Audit", "Statutory Audit", 3, "In Process"],
    ["XYZ Industries", "Audit", "Statutory Audit", -2, "Completed"], ["Dhillon Agro", "Audit", "Tax Audit (3CB-3CD)", 6, "In Process"],
    ["XYZ Industries", "ROC", "AOC-4", 30, "Not Started"], ["Kapoor Constructions", "ROC", "AOC-4", 30, "Not Started"],
    ["XYZ Industries", "ROC", "DIR-3 KYC", 7, "In Process"], ["Mehta Textiles", "ROC", "LLP Form 11", -95, "Completed"],
    ["Punjab Cold", "ROC", "LLP Form 11", -95, "Completed"], ["Kapoor Constructions", "ROC", "MGT-7A", 60, "Not Started"],
  ];
  audits.forEach(([n, cat, type, off, status]) => {
    compliance.push({ firmId: F, clientId: byName(n).id, category: cat as "Audit" | "ROC", complianceType: type, period: cat === "ROC" ? `FY ${Number(FY.slice(0, 4)) - 1}-${FY.slice(2, 4)}` : ay, financialYear: FY, dueDate: addDays(T, off), assignedTo: U.Rahul, priority: off <= 7 ? "High" : "Medium", status, filedDate: status === "Completed" ? addDays(T, off - 3) : null, ...by });
  });
  compliance.push({ firmId: F, clientId: byName("Sharma & Co").id, category: "CMA", complianceType: "CMA Report", period: FY, financialYear: FY, dueDate: T, assignedTo: U.Amit, priority: "High", status: "In Process", notes: "Bank wants projections for 3 years.", ...by });
  compliance.push({ firmId: F, clientId: byName("Punjab Cold").id, category: "CMA", complianceType: "CMA Report", period: FY, financialYear: FY, dueDate: addDays(T, 6), assignedTo: U.Rahul, priority: "Medium", status: "Documents Pending", ...by });
  const insertedCompliance = db.insert(s.complianceTasks).values(compliance).returning().all();
  for (const ct of insertedCompliance.filter((x) => x.status === "Filed" && x.filedDate)) {
    const cl = clients.find((c) => c.id === ct.clientId)!;
    log(cl.id, "compliance", "filed", `${ct.complianceType} (${ct.period}) filed`, ct.filedDate!, ct.assignedTo ?? ADMIN, ct.id);
  }

  /* ------------------------------------------------------------ documents (with small demo files) */
  const store = new LocalStorageDriver(UPLOADS);
  const docTemplates = ["Purchase Data", "Sales Data", "Bank Statement", "Expense Bills", "E-commerce Report", "Other Documents"];
  let pagesMade = 0;
  for (const [i, c] of gstClients.entries()) {
    const checklist = db
      .insert(s.documentChecklists)
      .values({ firmId: F, clientId: c.id, title: `${lastMonthLabel} GST`, period: lmLabel, category: "GST", requestedAt: addDays(thisMonth, 1), dueDate: addDays(thisMonth, 7), ...by })
      .returning()
      .get();
    const pattern = i % 5;
    for (const [j, name] of docTemplates.entries()) {
      let status: (typeof s.DOCUMENT_STATUSES)[number];
      if (name === "E-commerce Report") status = c.name.startsWith("ABC") || c.name.startsWith("Gupta") ? (pattern === 0 ? "Pending" : "Received") : "Not Required";
      else if (name === "Other Documents") status = "Not Required";
      else if (pattern === 0 && j < 3) status = j === 1 ? "Received" : "Pending";
      else if (pattern === 2 && j === 0) status = "Partial";
      else if (pattern === 3 && j >= 2) status = "Pending";
      else status = "Received";
      let file: Partial<typeof s.documents.$inferInsert> = {};
      if (status === "Received" || status === "Partial") {
        const key = `${F}/${checklist.id}/${crypto.randomUUID()}.pdf`;
        const pdf = demoPdf(`${c.name}`, `${name} — ${lastMonthLabel}`, "Demo document generated by the TaxPro Office seed script.");
        await store.put(key, pdf);
        pagesMade++;
        file = { storageKey: key, fileName: `${name.replace(/\s+/g, "_")}_${lmLabel.replace(" ", "_")}.pdf`, mimeType: "application/pdf", sizeBytes: pdf.length, receivedAt: addDays(thisMonth, between(1, 8)) };
        log(c.id, "document", "received", `${name} (${lastMonthLabel}) received`, file.receivedAt!, U.Neha, checklist.id);
      }
      db.insert(s.documents).values({ firmId: F, checklistId: checklist.id, clientId: c.id, name, status, ...file, ...by }).run();
    }
  }
  // ITR document checklists for individuals
  for (const n of ["Bansal Pharma", "Sethi Jewellers", "Malhotra"]) {
    const c = byName(n);
    const cl = db.insert(s.documentChecklists).values({ firmId: F, clientId: c.id, title: `ITR documents — ${ay}`, period: ay, category: "ITR", requestedAt: addDays(T, -20), dueDate: addDays(T, 3), ...by }).returning().get();
    for (const [j, name] of ["Form 26AS / AIS", "Bank Statements (all accounts)", "Investment Proofs (80C/80D)", "Capital Gains Statement"].entries()) {
      db.insert(s.documents).values({ firmId: F, checklistId: cl.id, clientId: c.id, name, status: j === 0 ? "Received" : j === 3 ? "Not Required" : "Pending", ...by }).run();
    }
  }

  /* ------------------------------------------------------------ CMA */
  const cmaSeed: [string, string, string, number, (typeof s.CMA_STATUSES)[number], number, Record<string, number>][] = [
    ["Sharma & Co", "Term loan renewal", "State Bank of India", 4500000, "In Preparation", 0, { sales: 42000000, purchases: 35500000, openingStock: 3800000, closingStock: 4200000, directExpenses: 1200000, indirectExpenses: 2100000, depreciation: 350000, interest: 620000, tax: 280000, capital: 9500000, termLoans: 3200000, workingCapitalLoans: 4500000, creditors: 3100000, otherCurrentLiabilities: 450000, fixedAssets: 6800000, debtors: 6300000, cash: 150000, bank: 820000, otherCurrentAssets: 400000, principalRepayment: 800000, projectedSales: 48000000, projectedNetProfit: 1350000 }],
    ["Dhillon Agro", "CC limit enhancement", "Punjab National Bank", 7500000, "Submitted", -20, { sales: 68000000, purchases: 52000000, openingStock: 7200000, closingStock: 8100000, directExpenses: 4800000, indirectExpenses: 3900000, depreciation: 900000, interest: 1150000, tax: 520000, capital: 16500000, termLoans: 5500000, workingCapitalLoans: 7500000, creditors: 4600000, otherCurrentLiabilities: 900000, fixedAssets: 12400000, debtors: 9800000, cash: 220000, bank: 1350000, otherCurrentAssets: 700000, principalRepayment: 1400000, projectedSales: 78000000, projectedNetProfit: 2400000 }],
    ["Punjab Cold", "Working capital assessment", "HDFC Bank", 3000000, "Data Pending", 6, { sales: 18500000, purchases: 2500000, directExpenses: 6200000, indirectExpenses: 3100000, depreciation: 1600000, interest: 780000, tax: 250000, capital: 12000000, termLoans: 6500000, workingCapitalLoans: 1800000, creditors: 900000, otherCurrentLiabilities: 400000, fixedAssets: 17500000, debtors: 2600000, cash: 90000, bank: 650000, otherCurrentAssets: 300000, principalRepayment: 1300000, projectedSales: 21000000 }],
    ["Mehta Textiles", "New term loan — machinery", "Bank of Baroda", 12000000, "Draft", 18, { sales: 96000000, purchases: 71000000, openingStock: 11000000, closingStock: 12500000, directExpenses: 9200000, indirectExpenses: 6100000, depreciation: 2100000, interest: 1900000, tax: 900000, capital: 28000000 }],
  ];
  for (const [n, purpose, bank, loan, status, dueOff, inputs] of cmaSeed) {
    const c = byName(n);
    const rec = db.insert(s.cmaRecords).values({ firmId: F, clientId: c.id, financialYear: FY, period: `FY ${Number(FY.slice(0, 4)) - 1}-${FY.slice(2, 4)} (Actual) + ${FY} (Projected)`, purpose, bank, loanAmount: toPaise(loan), status, dueDate: addDays(T, dueOff), assignedTo: n === "Sharma & Co" ? U.Amit : U.Rahul, inputs: JSON.stringify(inputs), reportGeneratedAt: status === "Submitted" ? `${addDays(T, dueOff - 3)}T11:00:00.000Z` : null, ...by }).returning().get();
    log(c.id, "cma", "created", `CMA prepared for ${bank} — ${purpose}`, addDays(T, Math.min(dueOff, 0) - 8), U.Rahul, rec.id);
  }

  /* ------------------------------------------------------------ tasks */
  const taskSeed: [string, string | null, (typeof s.TASK_CATEGORIES)[number], string, (typeof s.PRIORITIES)[number], number, (typeof s.TASK_STATUSES)[number]][] = [
    ["Follow up for purchase register", "Singh Auto", "Documents", "Amit", "High", 0, "In Progress"],
    ["Reconcile GSTR-2B with purchase register", "ABC Traders", "GST", "Rahul", "High", 0, "In Progress"],
    ["Prepare CMA projections (3 years)", "Sharma & Co", "CMA", "Amit", "High", 0, "In Progress"],
    ["Call client about overdue fees", "Singh Auto", "Billing", "Pooja", "Medium", 0, "Not Started"],
    ["Book statements & ledger scrutiny", "Mehta Textiles", "Audit", "Rahul", "High", 1, "Review"],
    ["Draft reply to GST ASMT-10 notice", "Sethi Jewellers", "Notice", "Rahul", "Critical", 2, "In Progress"],
    ["Collect Form 16 & AIS", "Rajesh Kumar", "ITR", "Neha", "Low", 5, "Not Started"],
    ["Prepare TDS Q2 challan summary", "XYZ Industries", "TDS", "Neha", "Medium", 1, "Not Started"],
    ["DSC renewal — collect KYC documents", "Kapoor Constructions", "Other", "Neha", "Medium", 3, "Not Started"],
    ["Send monthly bills for review", null, "Billing", "Pooja", "Medium", 1, "Not Started"],
    ["Update fixed asset register", "Dhillon Agro", "Accounting", "Neha", "Low", 6, "Not Started"],
    ["Client meeting — loan documentation", "Punjab Cold", "Client Meeting", "Varinder", "High", 2, "Not Started"],
    ["Verify e-way bills vs sales", "Bansal Pharma", "GST", "Amit", "Medium", -2, "In Progress"],
    ["Pending ledger confirmations", "Kapoor Constructions", "Audit", "Rahul", "High", -1, "Not Started"],
    ["Staff training — new GST return changes", null, "Admin", "Varinder", "Low", 9, "Not Started"],
    ["Bank reconciliation — August", "Malhotra", "Accounting", "Neha", "Medium", -4, "Completed"],
    ["File GSTR-1", "Gupta Electronics", "GST", "Amit", "High", -10, "Completed"],
    ["Issue payment receipts", null, "Billing", "Pooja", "Low", -3, "Completed"],
    ["Review ITR computation", "ABC Traders", "ITR", "Varinder", "High", 3, "Review"],
    ["Share audit query list with client", "XYZ Industries", "Audit", "Rahul", "Medium", 0, "Review"],
  ];
  for (const [title, cn, category, who, priority, off, status] of taskSeed) {
    db.insert(s.tasks).values({ firmId: F, title, clientId: cn ? byName(cn).id : null, category, assignedTo: U[who], priority, dueDate: addDays(T, off), status, completedAt: status === "Completed" ? `${addDays(T, off)}T15:00:00.000Z` : null, ...by }).run();
  }

  /* ------------------------------------------------------------ calendar events */
  const events: [string, string | null, (typeof s.EVENT_TYPES)[number], number, string, string][] = [
    ["Loan documentation meeting", "Punjab Cold", "Client Meeting", 2, "11:00", "12:00"],
    ["Audit closing meeting", "Mehta Textiles", "Client Meeting", 4, "15:00", "16:00"],
    ["GST notice discussion", "Sethi Jewellers", "Client Meeting", 1, "12:30", "13:00"],
    ["Weekly team review", null, "Internal", 0, "18:00", "18:30"],
    ["Weekly team review", null, "Internal", 7, "18:00", "18:30"],
    ["Quarterly fee review with partner firm", null, "Internal", 10, "10:00", "11:00"],
    ["New client onboarding — Chopra Furnishings", "Chopra", "Client Meeting", 5, "16:00", "16:45"],
  ];
  for (const [title, cn, type, off, st, et] of events) {
    db.insert(s.calendarEvents).values({ firmId: F, title, clientId: cn ? byName(cn).id : null, type, date: addDays(T, off), startTime: st, endTime: et, location: type === "Client Meeting" ? "Office" : null, ...by }).run();
  }

  /* ------------------------------------------------------------ notices */
  const noticeSeed: [string, (typeof s.DEPARTMENTS)[number], string, string, number, number, (typeof s.NOTICE_STATUSES)[number]][] = [
    ["Sethi Jewellers", "GST", "Scrutiny of returns (ASMT-10)", "Section 61", -12, 3, "In Progress"],
    ["ABC Traders", "Income Tax", "Intimation u/s 143(1)", "Section 143(1)", -20, 10, "Reply Prepared"],
    ["Kapoor Constructions", "TDS", "Short deduction default", "Section 200A", -30, -2, "New"],
    ["Singh Auto", "GST", "Mismatch GSTR-1 vs 3B (DRC-01B)", "Rule 88C", -8, 5, "New"],
    ["Mehta Textiles", "Income Tax", "Defective return", "Section 139(9)", -45, -30, "Closed"],
  ];
  for (const [cn, dept, type, section, noff, doff, status] of noticeSeed) {
    const c = byName(cn);
    db.insert(s.notices).values({ firmId: F, clientId: c.id, department: dept, noticeType: type, section, noticeDate: addDays(T, noff), dueDate: addDays(T, doff), reference: `${dept === "GST" ? "ZD03" : "ITBA/"}${between(100000, 999999)}${between(1000, 9999)}`, assignedTo: U.Rahul, status, responseDate: status === "Closed" ? addDays(T, noff + 10) : null, ...by }).run();
    log(c.id, "notice", "received", `${dept} notice received — ${type}`, addDays(T, noff), ADMIN);
  }

  /* ------------------------------------------------------------ DSC */
  const dscSeed: [string, string, number, (typeof s.DSC_RENEWAL_STATUSES)[number]][] = [
    ["Kapoor Constructions", "Anil Kapoor (Director)", 5, "Renewal Due"],
    ["XYZ Industries", "Sanjay Khanna (Director)", 12, "Renewal In Process"],
    ["Mehta Textiles", "Ramesh Mehta (Partner)", 26, "Active"],
    ["Punjab Cold", "Harjeet Singh (Partner)", -6, "Expired"],
    ["ABC Traders", "Ashok Bansal (Partner)", 140, "Active"],
    ["Dhillon Agro", "Gurpreet Dhillon (Partner)", 300, "Active"],
    ["Sharma & Co", "Vikas Sharma (Partner)", 22, "Active"],
    ["XYZ Industries", "Meena Khanna (Director)", 410, "Renewed"],
    ["Bansal Pharma", "Rohit Bansal", 60, "Active"],
  ];
  for (const [cn, holder, off, status] of dscSeed) {
    db.insert(s.dscRecords).values({ firmId: F, clientId: byName(cn).id, holderName: holder, issueDate: addDays(T, off - 730), expiryDate: addDays(T, off), renewalStatus: status, custody: pick(["With office", "With client"]), ...by }).run();
  }

  /* ------------------------------------------------------------ client portal user */
  db.insert(s.users).values({ firmId: F, name: "Ashok Bansal (ABC Traders)", email: "abc@client.demo", passwordHash: hash, role: "Client", clientId: byName("ABC Traders").id, ...by }).run();

  db.insert(s.activityLogs).values(activity).run();

  console.log(`Seeded firm "${firm!.name}" — ${clients.length} clients, ${seq - 1} invoices, ${insertedCompliance.length} compliance tasks, ${pagesMade} demo files.`);
  console.log(`Sign in with varinder@taxpro.demo / ${password} (Admin). Other users: rahul@, amit@, neha@, pooja@taxpro.demo; client portal: abc@client.demo`);
}

/** Minimal valid one-page PDF with a few lines of text (used only for demo documents). */
function demoPdf(title: string, subtitle: string, note: string): Buffer {
  const esc = (t: string) => t.replace(/[\\()]/g, (m) => `\\${m}`).replace(/[^\x20-\x7E]/g, "-");
  const content = `BT /F1 20 Tf 72 740 Td (${esc(title)}) Tj ET\nBT /F1 13 Tf 72 712 Td (${esc(subtitle)}) Tj ET\nBT /F1 10 Tf 72 680 Td (${esc(note)}) Tj ET`;
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objs.forEach((o, i) => {
    offsets.push(Buffer.byteLength(out));
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = Buffer.byteLength(out);
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
