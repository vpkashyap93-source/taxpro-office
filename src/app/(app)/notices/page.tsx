import Link from "next/link";
import { Bell } from "lucide-react";
import { DEPARTMENTS, NOTICE_STATUSES } from "@/db/schema";
import { requireStaff } from "@/server/auth";
import { listNotices } from "@/server/queries/work";
import { clientOptions, staffOptions } from "@/server/queries/common";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { DataTable } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/status-badge";
import { AssigneeChip } from "@/components/ui/avatar";
import { DueLabel } from "@/components/ui/due";
import { EmptyState } from "@/components/ui/states";
import { FilterChips, withParams } from "@/components/ui/filter-chips";
import { SearchBox, SelectFilter } from "@/components/ui/url-filters";
import { AddRecordButton, RecordModals } from "@/components/records/notice-dsc-forms";
import { formatDate, todayISO } from "@/lib/dates";
import { matches, readParams, type SearchParams } from "@/lib/params";

export const metadata = { title: "Notices" };

export default async function NoticesPage({ searchParams }: { searchParams: SearchParams }) {
  const auth = await requireStaff("notices");
  const sp = await readParams(searchParams);
  const today = todayISO();
  const all = listNotices(auth.firm.id);
  const isOpen = (n: (typeof all)[number]) => n.status !== "Closed" && n.status !== "Reply Submitted";
  const VIEWS: Record<string, { label: string; test: (n: (typeof all)[number]) => boolean }> = {
    open: { label: "Open", test: isOpen },
    overdue: { label: "Reply overdue", test: (n) => isOpen(n) && !!n.dueDate && n.dueDate < today },
    closed: { label: "Closed / Submitted", test: (n) => !isOpen(n) },
    all: { label: "All", test: () => true },
  };
  const view = sp.view && sp.view in VIEWS ? sp.view : "open";
  const base = { q: sp.q, department: sp.department, status: sp.status };
  const rows = all.filter(VIEWS[view]!.test).filter((n) => !sp.department || n.department === sp.department).filter((n) => !sp.status || n.status === sp.status).filter((n) => matches(sp.q, n.clientName, n.noticeType, n.section, n.reference));
  const editing = sp.edit ? all.find((n) => n.id === sp.edit) : null;
  const edit = (id: string) => withParams("/notices", { ...base, view: sp.view }, { edit: id });
  return (
    <div className="space-y-6">
      <PageHeader title="Notice Management" description="Departmental notices, reply deadlines and responses." actions={auth.can("notices", "edit") ? <AddRecordButton label="Add Notice" /> : undefined} />
      <Card>
        <div className="flex flex-col gap-3 border-b border-line p-4 lg:flex-row lg:items-center lg:justify-between">
          <FilterChips active={view} chips={Object.entries(VIEWS).map(([k, v]) => ({ key: k, label: v.label, href: withParams("/notices", base, { view: k === "open" ? undefined : k }), count: all.filter(v.test).length }))} />
          <div className="flex flex-wrap gap-2">
            <SelectFilter param="department" label="Department" placeholder="All departments" options={DEPARTMENTS} />
            <SelectFilter param="status" label="Status" placeholder="Any status" options={NOTICE_STATUSES} />
            <SearchBox placeholder="Client, type, DIN" className="min-w-0 basis-full sm:basis-auto sm:w-56" />
          </div>
        </div>
        <DataTable
          rows={rows}
          rowKey={(r) => r.id}
          caption="Notices"
          empty={<EmptyState icon={<Bell className="h-5.5 w-5.5" />} title="No notices" description="Nothing needs a reply right now." />}
          columns={[
            { key: "client", header: "Client", cell: (r) => <Link href={`/clients/${r.clientId}?tab=notices`} className="font-medium hover:underline">{r.clientName}</Link> },
            { key: "type", header: "Notice", cell: (r) => <Link href={edit(r.id)} scroll={false} className="block hover:underline"><span className="block font-medium">{r.noticeType}</span><span className="block text-xs text-ink-3">{r.department}{r.section ? ` · ${r.section}` : ""}</span></Link> },
            { key: "ref", header: "DIN / Reference", cell: (r) => <span className="tnum text-[13px] text-ink-2">{r.reference ?? "—"}</span>, hideBelow: "xl" },
            { key: "date", header: "Notice Date", cell: (r) => <span className="tnum text-ink-2">{formatDate(r.noticeDate)}</span>, hideBelow: "lg" },
            { key: "due", header: "Reply Due", cell: (r) => <DueLabel date={r.dueDate} done={!isOpen(r)} today={today} /> },
            { key: "who", header: "Assigned To", cell: (r) => <AssigneeChip name={r.assigneeName} />, hideBelow: "lg" },
            { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
          ]}
          mobileCard={(r) => (
            <Link href={edit(r.id)} scroll={false} className="block">
              <div className="flex justify-between gap-3"><p className="text-sm font-semibold">{r.clientName}</p><DueLabel date={r.dueDate} done={!isOpen(r)} today={today} /></div>
              <p className="text-xs text-ink-3">{r.department} · {r.noticeType}</p>
              <div className="mt-1.5"><StatusBadge status={r.status} /></div>
            </Link>
          )}
        />
      </Card>
      <RecordModals kind="notice" canEdit={auth.can("notices", "edit")} clients={clientOptions(auth.firm.id)} staff={staffOptions(auth.firm.id)} today={today} editing={editing ? { ...editing } : null} />
    </div>
  );
}
