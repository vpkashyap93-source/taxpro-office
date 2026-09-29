import Link from "next/link";
import { ClipboardCheck } from "lucide-react";
import { COMPLIANCE_CATEGORIES, COMPLIANCE_STATUSES } from "@/db/schema";
import { requireStaff } from "@/server/auth";
import { isComplianceDone, listCompliance } from "@/server/queries/work";
import { complianceTypeOptions, staffOptions } from "@/server/queries/common";
import { listClients } from "@/server/queries/clients";
import { setComplianceStatus } from "@/server/actions/work";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { DataTable } from "@/components/ui/table";
import { PriorityBadge, StatusBadge } from "@/components/ui/status-badge";
import { AssigneeChip } from "@/components/ui/avatar";
import { DueLabel } from "@/components/ui/due";
import { EmptyState } from "@/components/ui/states";
import { ProgressBar } from "@/components/ui/progress";
import { FilterChips, withParams } from "@/components/ui/filter-chips";
import { SearchBox, SelectFilter } from "@/components/ui/url-filters";
import { MobileFilters } from "@/components/ui/mobile-filters";
import { InlineStatus } from "@/components/ui/inline-status";
import { Pagination, paginate } from "@/components/ui/pagination";
import { ComplianceHeaderActions, ComplianceModals } from "@/components/compliance/compliance-forms";
import { addDays, addMonths, financialYearOf, monthLabel, startOfMonth, todayISO } from "@/lib/dates";
import { percent } from "@/lib/format";
import { matches, readParams, type SearchParams } from "@/lib/params";
import { cn } from "@/lib/cn";

export const metadata = { title: "Compliance" };

export default async function CompliancePage({ searchParams }: { searchParams: SearchParams }) {
  const auth = await requireStaff("compliance");
  const sp = await readParams(searchParams);
  const today = todayISO();
  const fy = financialYearOf(today);
  const all = listCompliance(auth.firm.id);

  const DUE: Record<string, { label: string; test: (r: (typeof all)[number]) => boolean }> = {
    open: { label: "Open", test: (r) => !isComplianceDone(r.status) },
    pending: { label: "Due today / overdue", test: (r) => !isComplianceDone(r.status) && r.dueDate <= today },
    today: { label: "Due Today", test: (r) => !isComplianceDone(r.status) && r.dueDate === today },
    overdue: { label: "Overdue", test: (r) => !isComplianceDone(r.status) && r.dueDate < today },
    week: { label: "Next 7 days", test: (r) => !isComplianceDone(r.status) && r.dueDate > today && r.dueDate <= addDays(today, 7) },
    done: { label: "Completed / Filed", test: (r) => isComplianceDone(r.status) },
    all: { label: "All", test: () => true },
  };
  const due = sp.due && sp.due in DUE ? sp.due : "open";
  const base = { category: sp.category, status: sp.status, staff: sp.staff, client: sp.client, fy: sp.fy, month: sp.month, q: sp.q };
  const filteredNoCat = all
    .filter(DUE[due]!.test)
    .filter((r) => !sp.status || r.status === sp.status)
    .filter((r) => !sp.staff || r.assignedTo === sp.staff)
    .filter((r) => !sp.client || r.clientId === sp.client)
    .filter((r) => !sp.fy || r.financialYear === sp.fy)
    .filter((r) => !sp.month || r.dueDate.startsWith(sp.month))
    .filter((r) => matches(sp.q, r.clientName, r.complianceType, r.period));
  const rows = filteredNoCat.filter((r) => !sp.category || r.category === sp.category);
  const pg = paginate(rows, sp.page, 30);

  // Progress per category within FY (independent of the "due" chip, so % stays meaningful).
  const fyRows = all.filter((r) => r.financialYear === (sp.fy ?? fy) && (!sp.client || r.clientId === sp.client) && (!sp.staff || r.assignedTo === sp.staff));
  const progress = (["GST", "ITR", "TDS", "CMA", "ROC", "Audit"] as const).map((cat) => {
    const inCat = fyRows.filter((r) => r.category === cat && (r.dueDate <= addDays(today, 30) || isComplianceDone(r.status)));
    const done = inCat.filter((r) => isComplianceDone(r.status)).length;
    return { cat, done, total: inCat.length, pct: percent(done, inCat.length), overdue: inCat.filter((r) => !isComplianceDone(r.status) && r.dueDate < today).length };
  });

  const canEdit = auth.can("compliance", "edit");
  const editingRow = sp.edit ? all.find((r) => r.id === sp.edit) : null;
  const clients = listClients(auth.firm.id).filter((c) => c.status !== "Inactive");
  const periods = [1, 0, -1, -2, -3].map((o) => monthLabel(addMonths(startOfMonth(today), o - 1))).concat(["Q1", "Q2", "Q3", "Q4", `AY ${fy.slice(0, 4)}-${String((Number(fy.slice(0, 4)) + 1) % 100).padStart(2, "0")}`]);
  const staff = staffOptions(auth.firm.id);
  const monthOpts = [-2, -1, 0, 1, 2].map((o) => addMonths(startOfMonth(today), o).slice(0, 7)).map((m) => ({ value: m, label: `Due in ${monthLabel(m, "long")}` }));
  const fyOpts = [...new Set(all.map((r) => r.financialYear))].sort().reverse();

  return (
    <div className="space-y-6">
      <PageHeader title="Compliance" description="GST, ITR, TDS, CMA, ROC and audit work — one tracker. Due dates are editable data, not a tax-law engine." actions={canEdit ? <ComplianceHeaderActions /> : undefined} />

      <div className="scrollbar-none -mx-4 flex snap-x gap-3 overflow-x-auto px-4 md:mx-0 md:grid md:grid-cols-3 md:gap-4 md:overflow-visible md:px-0 xl:grid-cols-6">
        {progress.map((p) => (
          <Link
            key={p.cat}
            href={withParams("/compliance", { ...base, due: sp.due }, { category: sp.category === p.cat ? undefined : p.cat })}
            aria-current={sp.category === p.cat ? "true" : undefined}
            className={cn("w-36 shrink-0 snap-start rounded-[var(--radius-card)] border bg-surface p-4 shadow-[var(--shadow-card)] transition hover:border-line-strong md:w-auto", sp.category === p.cat ? "border-navy-900 ring-1 ring-navy-900" : "border-line")}
          >
            <div className="flex items-baseline justify-between">
              <p className="text-sm font-semibold">{p.cat}</p>
              <p className="tnum text-lg font-semibold">{p.pct}%</p>
            </div>
            <ProgressBar value={p.pct} className="mt-2" tone={p.pct >= 75 ? "brand" : p.pct >= 50 ? "navy" : "warn"} label={`${p.cat} completion`} />
            <p className="mt-2 text-xs text-ink-3">
              {p.done}/{p.total} done{p.overdue ? <span className="text-danger"> · {p.overdue} overdue</span> : null}
            </p>
          </Link>
        ))}
      </div>

      <Card>
        <div className="space-y-3 border-b border-line p-4">
          <FilterChips active={due} chips={Object.entries(DUE).map(([k, v]) => ({ key: k, label: v.label, href: withParams("/compliance", base, { due: k === "open" ? undefined : k }), count: all.filter(v.test).filter((r) => !sp.category || r.category === sp.category).length }))} />
          <div className="flex flex-wrap items-start gap-2">
            <SearchBox placeholder="Search client or return…" className="min-w-0 flex-1 md:order-last md:w-52 md:flex-none" />
            <MobileFilters active={[sp.category, sp.status, sp.month, sp.fy, sp.staff, sp.client].filter(Boolean).length}>
              <SelectFilter param="category" label="Service" placeholder="All services" options={COMPLIANCE_CATEGORIES} />
              <SelectFilter param="status" label="Status" placeholder="Any status" options={COMPLIANCE_STATUSES} />
              <SelectFilter param="month" label="Month" placeholder="Any month" options={monthOpts} />
              <SelectFilter param="fy" label="Financial year" placeholder="Any FY" options={fyOpts} />
              <SelectFilter param="staff" label="Assigned to" placeholder="Anyone" options={staff} />
              <SelectFilter param="client" label="Client" placeholder="All clients" options={clients.map((c) => ({ value: c.id, label: c.name }))} className="md:max-w-52" />
            </MobileFilters>
          </div>
        </div>
        <DataTable
          rows={pg.slice}
          rowKey={(r) => r.id}
          caption="Compliance tasks"
          rowClassName={(r) => (!isComplianceDone(r.status) && r.dueDate < today ? "bg-danger-bg/25" : undefined)}
          empty={<EmptyState icon={<ClipboardCheck className="h-5.5 w-5.5" />} title="No compliance work matches" description="Adjust the filters, or create new compliance items." />}
          columns={[
            { key: "client", header: "Client", cell: (r) => <Link href={`/clients/${r.clientId}?tab=compliance`} className="font-medium hover:underline">{r.clientName}</Link> },
            {
              key: "type",
              header: "Compliance",
              cell: (r) => (
                <Link href={withParams("/compliance", { ...base, due: sp.due, page: sp.page }, { edit: r.id })} scroll={false} className="group block">
                  <span className="block font-medium text-ink group-hover:underline">{r.complianceType}</span>
                  <span className="block text-xs text-ink-3">{r.category}</span>
                </Link>
              ),
            },
            { key: "period", header: "Period", cell: (r) => <span className="whitespace-nowrap text-ink-2">{r.period}</span> },
            { key: "fy", header: "FY", cell: (r) => <span className="tnum text-ink-3">{r.financialYear}</span>, hideBelow: "2xl" },
            { key: "due", header: "Due Date", cell: (r) => <DueLabel date={r.dueDate} done={isComplianceDone(r.status)} today={today} showDate /> },
            { key: "assignee", header: "Assigned To", cell: (r) => <AssigneeChip name={r.assigneeName} />, hideBelow: "lg" },
            { key: "priority", header: "Priority", cell: (r) => <PriorityBadge priority={r.priority} />, hideBelow: "xl" },
            { key: "status", header: "Status", cell: (r) => (canEdit ? <InlineStatus id={r.id} status={r.status} options={COMPLIANCE_STATUSES} action={setComplianceStatus} label={`Status of ${r.complianceType} for ${r.clientName}`} /> : <StatusBadge status={r.status} />) },
          ]}
          mobileCard={(r) => (
            <div>
              <Link href={withParams("/compliance", { ...base, due: sp.due }, { edit: r.id })} scroll={false} className="block">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{r.clientName}</p>
                    <p className="text-[13px] text-ink-2">{r.complianceType} · {r.period}</p>
                  </div>
                  <DueLabel date={r.dueDate} done={isComplianceDone(r.status)} today={today} />
                </div>
              </Link>
              <div className="mt-2 flex items-center gap-2">
                {canEdit ? <InlineStatus id={r.id} status={r.status} options={COMPLIANCE_STATUSES} action={setComplianceStatus} label={`Status of ${r.complianceType}`} /> : <StatusBadge status={r.status} />}
                <PriorityBadge priority={r.priority} />
                <span className="ms-auto text-xs"><AssigneeChip name={r.assigneeName} /></span>
              </div>
            </div>
          )}
        />
        <Pagination {...pg} noun="items" href={(p) => withParams("/compliance", { ...base, due: sp.due }, { page: p > 1 ? String(p) : undefined })} />
      </Card>

      <ComplianceModals
        canEdit={canEdit}
        ctx={{ clients: clients.map((c) => ({ value: c.id, label: c.name, services: c.services })), staff, types: complianceTypeOptions(auth.firm.id), fy, periods }}
        editing={editingRow ? { ...editingRow } : null}
      />
    </div>
  );
}
