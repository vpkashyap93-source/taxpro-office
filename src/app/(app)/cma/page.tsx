import Link from "next/link";
import { Briefcase, Plus } from "lucide-react";
import { CMA_STATUSES } from "@/db/schema";
import { requireStaff } from "@/server/auth";
import { listCma } from "@/server/queries/work";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { DataTable } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/status-badge";
import { AssigneeChip } from "@/components/ui/avatar";
import { DueLabel } from "@/components/ui/due";
import { EmptyState } from "@/components/ui/states";
import { LinkButton } from "@/components/ui/button";
import { SearchBox, SelectFilter } from "@/components/ui/url-filters";
import { computeCma, parseCmaInputs } from "@/lib/cma";
import { formatMetric } from "@/lib/format";
import { formatINR } from "@/lib/money";
import { addDays, todayISO } from "@/lib/dates";
import { matches, readParams, type SearchParams } from "@/lib/params";

export const metadata = { title: "CMA" };

export default async function CmaListPage({ searchParams }: { searchParams: SearchParams }) {
  const auth = await requireStaff("cma");
  const sp = await readParams(searchParams);
  const today = todayISO();
  const all = listCma(auth.firm.id);
  const rows = all.filter((r) => !sp.status || r.status === sp.status).filter((r) => matches(sp.q, r.clientName, r.purpose, r.bank));
  const ratio = (json: string, key: string) => {
    const m = computeCma(parseCmaInputs(json)).find((x) => x.key === key)!;
    return formatMetric(m.value, m.format);
  };
  const open = all.filter((r) => r.status !== "Submitted" && r.status !== "Final");
  return (
    <div className="space-y-6">
      <PageHeader title="CMA" description="Credit Monitoring Arrangement cases — inputs, transparent ratios and bank-ready reports." actions={auth.can("cma", "edit") ? <LinkButton href="/cma/new" icon={<Plus className="h-4 w-4" />}>New CMA</LinkButton> : undefined} />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {[
          { label: "Open cases", value: open.length },
          { label: "Due in 7 days", value: open.filter((r) => r.dueDate && r.dueDate >= today && r.dueDate <= addDays(today, 7)).length },
          { label: "Awaiting data", value: all.filter((r) => r.status === "Data Pending").length },
          { label: "Loan value in pipeline", value: formatINR(open.reduce((a, r) => a + (r.loanAmount ?? 0), 0)) },
        ].map((m) => (
          <div key={m.label} className="rounded-[var(--radius-card)] border border-line bg-surface px-4 py-3.5 shadow-[var(--shadow-card)] sm:px-5">
            <p className="text-[12.5px] font-medium text-ink-3">{m.label}</p>
            <p className="tnum mt-0.5 text-2xl font-semibold">{m.value}</p>
          </div>
        ))}
      </div>
      <Card>
        <div className="flex flex-col gap-2 border-b border-line p-4 sm:flex-row sm:justify-end">
          <SelectFilter param="status" label="Status" placeholder="Any status" options={CMA_STATUSES} />
          <SearchBox placeholder="Client, purpose or bank" className="sm:w-64" />
        </div>
        <DataTable
          rows={rows}
          rowKey={(r) => r.id}
          caption="CMA cases"
          empty={<EmptyState icon={<Briefcase className="h-5.5 w-5.5" />} title="No CMA cases" description="Start a new CMA to prepare projections and ratios for a bank." />}
          columns={[
            { key: "client", header: "Client", cell: (r) => <Link href={`/clients/${r.clientId}?tab=cma`} className="font-medium hover:underline">{r.clientName}</Link> },
            { key: "purpose", header: "Purpose", cell: (r) => <Link href={`/cma/${r.id}`} className="text-navy-600 hover:underline">{r.purpose}</Link> },
            { key: "bank", header: "Bank", cell: (r) => <span className="text-ink-2">{r.bank ?? "—"}</span>, hideBelow: "lg" },
            { key: "loan", header: "Limit", align: "right", cell: (r) => <span className="tnum">{r.loanAmount ? formatINR(r.loanAmount) : "—"}</span>, hideBelow: "xl" },
            { key: "cr", header: "Current Ratio", align: "right", cell: (r) => <span className="tnum">{ratio(r.inputs, "currentRatio")}</span>, hideBelow: "xl" },
            { key: "dscr", header: "DSCR", align: "right", cell: (r) => <span className="tnum">{ratio(r.inputs, "dscr")}</span>, hideBelow: "lg" },
            { key: "due", header: "Target", cell: (r) => <DueLabel date={r.dueDate} done={r.status === "Submitted" || r.status === "Final"} today={today} /> },
            { key: "who", header: "Assigned", cell: (r) => <AssigneeChip name={r.assigneeName} />, hideBelow: "xl" },
            { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
          ]}
          mobileCard={(r) => (
            <Link href={`/cma/${r.id}`} className="block">
              <div className="flex justify-between gap-3">
                <p className="text-sm font-semibold">{r.clientName}</p>
                <StatusBadge status={r.status} />
              </div>
              <p className="text-xs text-ink-3">{r.purpose} · {r.bank}</p>
              <p className="mt-1 text-xs text-ink-2">Current ratio {ratio(r.inputs, "currentRatio")} · DSCR {ratio(r.inputs, "dscr")}</p>
            </Link>
          )}
        />
      </Card>
    </div>
  );
}
