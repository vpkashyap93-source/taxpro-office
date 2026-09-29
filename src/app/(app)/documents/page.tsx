import Link from "next/link";
import { FileStack, Leaf } from "lucide-react";
import { COMPLIANCE_CATEGORIES } from "@/db/schema";
import { requireStaff } from "@/server/auth";
import { listChecklists } from "@/server/queries/work";
import { clientOptions } from "@/server/queries/common";
import { paperlessMetrics } from "@/server/queries/dashboard";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/states";
import { ProgressBar } from "@/components/ui/progress";
import { FilterChips, withParams } from "@/components/ui/filter-chips";
import { SearchBox, SelectFilter } from "@/components/ui/url-filters";
import { DocumentHeaderActions, DocumentModals, type Checklist } from "@/components/documents/document-ui";
import { addMonths, formatDate, monthLabel, startOfMonth, todayISO } from "@/lib/dates";
import { percent } from "@/lib/format";
import { matches, readParams, type SearchParams } from "@/lib/params";

export const metadata = { title: "Documents" };

export default async function DocumentsPage({ searchParams }: { searchParams: SearchParams }) {
  const auth = await requireStaff("documents");
  const sp = await readParams(searchParams);
  const today = todayISO();
  const raw = listChecklists(auth.firm.id);
  const checklists: Checklist[] = raw.map((c) => ({
    id: c.id,
    clientId: c.clientId,
    clientName: c.clientName,
    clientMobile: c.clientMobile,
    clientEmail: c.clientEmail,
    title: c.title,
    period: c.period,
    category: c.category,
    dueDate: c.dueDate,
    requestedAt: c.requestedAt,
    pending: c.pending,
    items: c.items.map((d) => ({ id: d.id, name: d.name, status: d.status, fileName: d.fileName, sizeBytes: d.sizeBytes, mimeType: d.mimeType, receivedAt: d.receivedAt, notes: d.notes, hasFile: !!d.storageKey })),
  }));
  const STATUS: Record<string, { label: string; test: (c: Checklist) => boolean }> = {
    pending: { label: "Pending", test: (c) => c.pending > 0 },
    complete: { label: "Complete", test: (c) => c.pending === 0 },
    all: { label: "All", test: () => true },
  };
  const status = sp.status && sp.status in STATUS ? sp.status : "pending";
  const base = { q: sp.q, category: sp.category };
  const rows = checklists
    .filter(STATUS[status]!.test)
    .filter((c) => !sp.category || c.category === sp.category)
    .filter((c) => matches(sp.q, c.clientName, c.title, ...c.items.map((i) => i.name)))
    .sort((a, b) => b.pending - a.pending || a.clientName.localeCompare(b.clientName));
  const totalPending = checklists.reduce((a, c) => a + c.pending, 0);
  const paper = paperlessMetrics(auth.firm.id);
  const periods = [0, -1, -2, -3].map((o) => monthLabel(addMonths(startOfMonth(today), o))).concat(["Q2", `AY ${today.slice(0, 4)}-${String((Number(today.slice(0, 4)) + 1) % 100).padStart(2, "0")}`]);

  return (
    <div className="space-y-6">
      <PageHeader title="Documents" description="Who has sent what — and who still hasn't." actions={auth.can("documents", "edit") ? <DocumentHeaderActions /> : undefined} />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {[
          { label: "Documents Pending", value: totalPending, tone: "text-warn" },
          { label: "Clients yet to send", value: new Set(checklists.filter((c) => c.pending > 0).map((c) => c.clientId)).size, tone: "text-ink" },
          { label: "Overdue requests", value: checklists.filter((c) => c.pending > 0 && c.dueDate && c.dueDate < today).length, tone: "text-danger" },
          { label: "Stored digitally", value: `${paper.digitalDocsPct}%`, tone: "text-brand", icon: true },
        ].map((m) => (
          <div key={m.label} className="rounded-[var(--radius-card)] border border-line bg-surface px-4 py-3.5 shadow-[var(--shadow-card)] sm:px-5">
            <p className="flex items-center gap-1.5 text-[12.5px] font-medium text-ink-3">{m.icon && <Leaf className="h-3.5 w-3.5 text-brand" />}{m.label}</p>
            <p className={`tnum mt-0.5 text-2xl font-semibold ${m.tone}`}>{m.value}</p>
          </div>
        ))}
      </div>

      <Card>
        <div className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
          <FilterChips active={status} chips={Object.entries(STATUS).map(([k, v]) => ({ key: k, label: v.label, href: withParams("/documents", base, { status: k === "pending" ? undefined : k }), count: checklists.filter(v.test).length }))} />
          <div className="flex flex-col gap-2 sm:flex-row">
            <SelectFilter param="category" label="Category" placeholder="All categories" options={COMPLIANCE_CATEGORIES} />
            <SearchBox placeholder="Client or document" className="sm:w-60" />
          </div>
        </div>
      </Card>

      {rows.length === 0 ? (
        <Card>
          <EmptyState icon={<FileStack className="h-5.5 w-5.5" />} title={status === "pending" ? "All documents received" : "No document requests"} description="Create a request to track what each client needs to send." />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {rows.map((c) => {
            const needed = c.items.filter((i) => i.status !== "Not Required");
            const got = needed.filter((i) => i.status === "Received").length;
            const pct = percent(got, needed.length);
            const overdue = c.pending > 0 && c.dueDate && c.dueDate < today;
            return (
              <Link key={c.id} href={withParams("/documents", { ...base, status: sp.status }, { checklist: c.id })} scroll={false} className="group min-w-0 rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:border-line-strong hover:shadow-[var(--shadow-raised)]">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold group-hover:underline">{c.clientName}</p>
                    <p className="text-[13px] text-ink-3">{c.title}</p>
                  </div>
                  {c.pending > 0 ? <Badge tone={overdue ? "danger" : "warn"}>Documents Pending: {c.pending}</Badge> : <Badge tone="ok">Complete</Badge>}
                </div>
                <ProgressBar value={pct} className="mt-4" tone={pct === 100 ? "brand" : "navy"} label={`${c.clientName} documents received`} />
                <p className="mt-1.5 text-xs text-ink-3">{got} of {needed.length} received{c.dueDate ? ` · needed by ${formatDate(c.dueDate, { year: false })}` : ""}</p>
                <ul className="mt-3 flex flex-wrap gap-1.5">
                  {c.items.map((i) => (
                    <li key={i.id}>
                      <Badge tone={i.status === "Received" ? "ok" : i.status === "Partial" ? "warn" : i.status === "Pending" ? (overdue ? "danger" : "neutral") : "neutral"} className={i.status === "Not Required" ? "line-through opacity-60" : ""}>
                        {i.name}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </Link>
            );
          })}
        </div>
      )}
      <DocumentModals checklists={checklists} clients={clientOptions(auth.firm.id)} periods={periods} firmName={auth.firm.name} canEdit={auth.can("documents", "edit")} />
    </div>
  );
}
