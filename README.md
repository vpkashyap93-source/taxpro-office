# TaxPro Office

**Practice management for Indian tax professionals, accountants, GST practitioners and CA firms.**
*Organised Practice • Happier Clients • A Greener Tomorrow*

One operating system for a tax office. Open it in the morning and immediately see what is due, who needs attention, who has not sent documents, who has not paid, how much was billed and collected, and what the team is working on.

> This app lives in `taxpro-office/`. The existing restaurant app at the repository root is untouched.

---

## Quick start

```bash
cd taxpro-office
npm install
cp .env.example .env.local     # set SESSION_SECRET for production
npm run dev                    # migrates + seeds demo data on first run, then starts on :3000
```

Sign in with **varinder@taxpro.demo** / **TaxPro@2026** (Admin).

| Demo login | Role | What it shows |
|---|---|---|
| varinder@taxpro.demo | Admin | Everything |
| rahul@taxpro.demo | Senior | Work + view-only finance |
| amit@taxpro.demo / neha@taxpro.demo | Junior | Work only — no billing, payments, reports or settings |
| pooja@taxpro.demo | Billing Staff | Billing, payments, reports |
| abc@client.demo | Client portal | ABC Traders' own data only |

Demo data (19 clients, ~90 invoices, payments, GST/ITR/TDS/ROC/audit work, documents, CMA cases, notices, DSCs, tasks) is generated **relative to today**, so the dashboard always looks current. `npm run db:reset` rebuilds it.

| Script | Purpose |
|---|---|
| `npm run dev` / `npm start` | Run (runs `db:setup` first: migrations + seed if empty) |
| `npm run build` | Production build |
| `npm run typecheck` / `npm run lint` | Static checks |
| `npm test` | Unit tests (Vitest) |
| `npm run test:e2e` | Browser smoke test against a running server (`BASE=http://localhost:3000`) — **mutates data**, use a scratch DB |
| `npm run db:generate` | Create a migration after changing `src/db/schema.ts` |
| `npm run db:reset` | Delete `./data` and reseed |

---

## What's in the first build

| Module | Highlights |
|---|---|
| **Dashboard** | 6 clickable KPIs, Today's Work, Needs Attention, compliance progress, billing vs collection chart, overdue bills, pending documents, upcoming deadlines, revenue trend, top clients, team workload, Paperless Practice. Finance cards hidden for roles without billing access. |
| **Clients** | Search by name/PAN/GSTIN/mobile/email; filters (active, pending, high value, service…); PAN/GSTIN/TAN/UDYAM format checks incl. GSTIN check digit & PAN match; full profile with 10 tabs and activity timeline. |
| **Billing & Invoices** | Create/edit, drafts, sequential numbering per FY (`TPO/2026-27/0001`), CGST+SGST vs IGST by state, amount in words, A4 print/PDF, WhatsApp/email share with explicit "I sent it" confirmation, reminders, cancel. Bill Tracker with status filters and pagination. |
| **Recurring billing** | Per-client fee lines, Monthly/Quarterly/Yearly/Custom, ON/OFF. **Generate Monthly Bills** previews every due period, lets you deselect clients, and creates *Generated* (not sent) invoices. A unique index on (plan, period) prevents double billing. |
| **Payments** | Partial payments, on-account receipts, over-payment blocked server-side, collection by mode. |
| **Compliance** | Unified tracker (GST/ITR/TDS/CMA/ROC/Audit), inline status change, bulk create for all GST clients, due-date suggestions from **editable** master data. |
| **Documents** | Per-client/period checklists, real uploads through a storage driver, authenticated view/download, WhatsApp/email request listing exactly what's pending, notes, partial receipts. |
| **CMA** | Case list, editor with live ratios, printable report with every formula shown, benchmark hints, duplicate. |
| **Tasks / Calendar** | Today/Upcoming/Overdue/Completed/My/Team views; month/week/day calendar aggregating compliance, bills, tasks, meetings, CMA, DSC expiry and notice deadlines. |
| **Notices, DSC Tracker** | Notice lifecycle with reply due dates; DSC expiry buckets (expired / 7 / 15 / 30 days). |
| **Reports** | 11 reports with filters, charts, totals, CSV export (formula-injection safe) and print. |
| **Team** | Staff management and an editable role × module permission matrix (Admin can't lock themselves out). |
| **Client Portal** | Real client login: profile, compliance, pending documents **with upload**, bills (printable), payments, reports, notices. Staff can preview any client's portal. Messaging is marked "coming soon". |
| **Search & notifications** | Ctrl/⌘+K grouped search (clients, bills, tasks, compliance, documents), permission-aware. Notifications for due-tomorrow work, overdue invoices, pending documents, DSC expiry, CMA deadlines, assignments. |
| **Mobile** | Purpose-built: bottom nav (Home, Clients, +, Tasks, More), quick-add sheet, card layouts instead of squeezed tables, bottom-sheet dialogs. |

---

## Architecture

```
src/
  app/                  Next.js App Router (server components by default)
    (app)/…             Staff app — every page calls requireStaff(module)
    portal/…            Client portal — requireClientUser()
    api/                search, document download, report CSV (all authenticated)
    login/, proxy.ts    Sign-in; proxy does an optimistic cookie check only
  db/schema.ts          Relational model (Drizzle ORM)
  server/
    auth.ts             Sessions, password hashing, authorize()
    actions/*.ts        Server actions: Zod validation → permission check → firm-scoped write → audit log
    queries/*.ts        Read/service layer (firm-scoped)
    storage/            Storage driver interface (local disk now; S3 etc. pluggable)
  lib/                  Pure, tested domain logic: money/GST, dates/FY, invoice status,
                        recurring periods, CMA formulas, identifiers, permissions, validation
  components/ui         Design system: Button, Card, Modal, DataTable, Badge/StatusBadge,
                        form fields, DatePicker, SearchBox, filters, charts, Empty/Loading/Error states
  components/layout     Sidebar, header, global search, mobile navigation
```

**Data model** — Firms, Users (staff + client-portal logins), Sessions, Settings, Clients, ClientServices, Invoices, InvoiceItems, RecurringBills, RecurringBillItems, Payments, ComplianceTypes, ComplianceTasks, DocumentChecklists, Documents, CMARecords, Tasks, CalendarEvents, Notices, DSCRecords, Notifications, ActivityLogs. Every business row has `firm_id` (multi-firm ready) and `created_at / updated_at / created_by / updated_by`. Money is stored in integer paise.

### Design decisions worth knowing

- **Separate folder, not a rewrite.** The repo already contains a Vite restaurant app; TaxPro Office is a new Next.js app in `taxpro-office/` so nothing existing is deleted.
- **SQLite via Drizzle** gives a real relational database with zero setup; the schema and queries are portable to PostgreSQL by switching the Drizzle dialect/driver.
- **Staff = Users.** The "Staff" entity is the `users` table with staff roles, avoiding two sources of truth for people.
- **No hard-coded statutory due dates.** Compliance types (and their optional default due day) are editable data in Settings; each task stores its own due date.
- **Derived invoice status.** "Paid", "Partially Paid" and "Overdue" are computed from payments and due date, so they can never drift out of sync.
- **Nothing is sent automatically.** WhatsApp/email open the user's own app with a pre-filled message; the invoice is marked sent only after the user confirms.
- **Paperless metrics are measured, not claimed** — computed from digital documents, digitally shared bills and generated/exported reports. "Pages saved" is an explicit estimate (1 page each).
- **"Download PDF"** uses the browser's print-to-PDF with an A4 print stylesheet (no server PDF dependency).

## Security

- Passwords hashed with bcrypt (cost 12); login throttling; generic error messages.
- Opaque session tokens in HTTP-only, SameSite=Lax cookies; stored server-side as an HMAC (needs `SESSION_SECRET`, required in production); configurable expiry.
- Every server action, route handler and page re-checks authentication **and** the role's permission; every query is scoped to the user's firm.
- Server-side Zod validation for all input; parameterised queries only.
- Uploaded files: extension/MIME allow-list, size limit, server-generated storage keys, served only through an authenticated route (clients only their own files).
- Security headers (nosniff, frame-deny, referrer policy). No secrets in code — see `.env.example`.

## Integrations — honest status

Not connected: GST portal, Income Tax e-filing, TRACES, MCA, WhatsApp Business API, SMTP email. TaxPro Office is a practice-management tool and does not file returns. Settings → Integrations lists these as "Not connected".

## Roadmap (not in this build)

Cloud document storage driver (S3-compatible), transactional email/WhatsApp API sending, client-portal messaging, credit notes, Tally/Excel import, 2FA, PostgreSQL deployment profile, background job for scheduled reminders.
