import Link from "next/link";
import { KeyRound } from "lucide-react";
import { requireStaff } from "@/server/auth";
import { listDsc } from "@/server/queries/work";
import { clientOptions } from "@/server/queries/common";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { DataTable } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/states";
import { withParams } from "@/components/ui/filter-chips";
import { SearchBox } from "@/components/ui/url-filters";
import { AddRecordButton, RecordModals } from "@/components/records/notice-dsc-forms";
import { diffDays, formatDate, todayISO } from "@/lib/dates";
import { dscBucket, type DscBucket } from "@/lib/dsc";
import { matches, readParams, type SearchParams } from "@/lib/params";
import { cn } from "@/lib/cn";

export const metadata = { title: "DSC Tracker" };

const BUCKETS: { key: DscBucket; label: string; tone: string }[] = [
  { key: "Expired", label: "Expired", tone: "text-danger" },
  { key: "7 days", label: "Expiring in 7 days", tone: "text-danger" },
  { key: "15 days", label: "Expiring in 15 days", tone: "text-warn" },
  { key: "30 days", label: "Expiring in 30 days", tone: "text-gold" },
];

export default async function DscPage({ searchParams }: { searchParams: SearchParams }) {
  const auth = await requireStaff("dsc");
  const sp = await readParams(searchParams);
  const today = todayISO();
  const all = listDsc(auth.firm.id).map((d) => ({ ...d, bucket: d.renewalStatus === "Renewed" ? ("Valid" as DscBucket) : dscBucket(d.expiryDate, today) }));
  const rows = all.filter((d) => !sp.bucket || d.bucket === sp.bucket).filter((d) => matches(sp.q, d.clientName, d.holderName));
  const editing = sp.edit ? all.find((d) => d.id === sp.edit) : null;
  return (
    <div className="space-y-6">
      <PageHeader title="DSC Tracker" description="Digital Signature Certificates — expiry and renewal." actions={auth.can("dsc", "edit") ? <AddRecordButton label="Add DSC" /> : undefined} />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {BUCKETS.map((b) => (
          <Link key={b.key} href={withParams("/dsc", { q: sp.q }, { bucket: sp.bucket === b.key ? undefined : b.key })} aria-current={sp.bucket === b.key ? "true" : undefined} className={cn("rounded-[var(--radius-card)] border bg-surface px-4 py-3.5 shadow-[var(--shadow-card)] transition hover:border-line-strong sm:px-5", sp.bucket === b.key ? "border-navy-900 ring-1 ring-navy-900" : "border-line")}>
            <p className="text-[12.5px] font-medium text-ink-3">{b.label}</p>
            <p className={cn("tnum mt-0.5 text-2xl font-semibold", b.tone)}>{all.filter((d) => d.bucket === b.key).length}</p>
          </Link>
        ))}
      </div>
      <Card>
        <div className="flex justify-end border-b border-line p-4">
          <SearchBox placeholder="Client or holder" className="w-full sm:w-64" />
        </div>
        <DataTable
          rows={rows}
          rowKey={(r) => r.id}
          caption="DSC records"
          empty={<EmptyState icon={<KeyRound className="h-5.5 w-5.5" />} title="No DSC records" />}
          columns={[
            { key: "client", header: "Client", cell: (r) => <Link href={`/clients/${r.clientId}?tab=dsc`} className="font-medium hover:underline">{r.clientName}</Link> },
            { key: "holder", header: "DSC Holder", cell: (r) => <Link href={withParams("/dsc", { q: sp.q, bucket: sp.bucket }, { edit: r.id })} scroll={false} className="text-navy-600 hover:underline">{r.holderName}</Link> },
            { key: "issue", header: "Issue Date", cell: (r) => <span className="tnum text-ink-2">{formatDate(r.issueDate)}</span>, hideBelow: "lg" },
            { key: "exp", header: "Expiry Date", cell: (r) => <span className="tnum">{formatDate(r.expiryDate)} <span className="text-xs text-ink-3">({diffDays(today, r.expiryDate) >= 0 ? `${diffDays(today, r.expiryDate)}d left` : `${-diffDays(today, r.expiryDate)}d ago`})</span></span> },
            { key: "bucket", header: "Validity", cell: (r) => <StatusBadge status={r.bucket} /> },
            { key: "renewal", header: "Renewal Status", cell: (r) => <StatusBadge status={r.renewalStatus} /> },
            { key: "custody", header: "Custody", cell: (r) => <span className="text-ink-2">{r.custody ?? "—"}</span>, hideBelow: "xl" },
          ]}
          mobileCard={(r) => (
            <Link href={withParams("/dsc", {}, { edit: r.id })} scroll={false} className="flex items-center justify-between gap-3">
              <div><p className="text-sm font-semibold">{r.holderName}</p><p className="text-xs text-ink-3">{r.clientName} · expires {formatDate(r.expiryDate)}</p></div>
              <StatusBadge status={r.bucket} />
            </Link>
          )}
        />
      </Card>
      <RecordModals kind="dsc" canEdit={auth.can("dsc", "edit")} clients={clientOptions(auth.firm.id)} staff={[]} today={today} editing={editing ? { ...editing } : null} />
    </div>
  );
}
