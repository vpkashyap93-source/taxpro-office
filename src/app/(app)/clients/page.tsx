import Link from "next/link";
import { Users } from "lucide-react";
import { SERVICES } from "@/db/schema";
import { requireStaff } from "@/server/auth";
import { listClients } from "@/server/queries/clients";
import { staffOptions } from "@/server/queries/common";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { DataTable } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/status-badge";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/states";
import { FilterChips, withParams } from "@/components/ui/filter-chips";
import { SearchBox, SelectFilter } from "@/components/ui/url-filters";
import { AddClientButton, ClientModals } from "@/components/clients/clients-toolbar";
import { Pagination, paginate } from "@/components/ui/pagination";
import { formatINR } from "@/lib/money";
import { financialYearOf, todayISO } from "@/lib/dates";
import { matches, readParams, type SearchParams } from "@/lib/params";

export const metadata = { title: "Clients" };

const HIGH_VALUE_MONTHLY = 5000_00; // ₹5,000+ monthly retainer
const HIGH_VALUE_YTD = 50000_00; // or ₹50,000+ billed this FY

export default async function ClientsPage({ searchParams }: { searchParams: SearchParams }) {
  const auth = await requireStaff("clients");
  const sp = await readParams(searchParams);
  const all = listClients(auth.firm.id);
  const showMoney = auth.can("billing");
  const filter = sp.filter ?? "all";

  const isHighValue = (c: (typeof all)[number]) => c.monthlyFee >= HIGH_VALUE_MONTHLY || c.billedYtd >= HIGH_VALUE_YTD;
  const byFilter: Record<string, (c: (typeof all)[number]) => boolean> = {
    all: () => true,
    active: (c) => c.status === "Active",
    inactive: (c) => c.status === "Inactive",
    prospect: (c) => c.status === "Prospect",
    hold: (c) => c.status === "On Hold",
    pending: (c) => c.pendingWork > 0 || c.pendingDocs > 0,
    ...(showMoney ? { high: isHighValue } : {}),
  };
  const rows = all
    .filter(byFilter[filter] ?? (() => true))
    .filter((c) => !sp.service || c.services.includes(sp.service as (typeof SERVICES)[number]))
    .filter((c) => matches(sp.q, c.name, c.tradeName, c.pan, c.gstin, c.mobile, c.email, c.code));

  const base = { q: sp.q, service: sp.service };
  const chip = (key: string, label: string) => ({ key, label, href: withParams("/clients", base, { filter: key === "all" ? undefined : key }), count: all.filter(byFilter[key]!).length });
  const pg = paginate(rows, sp.page);
  const editing = sp.edit ? all.find((c) => c.id === sp.edit) : null;

  return (
    <div>
      <PageHeader
        title="Clients"
        description={`${all.length} clients · ${all.filter((c) => c.status === "Active").length} active`}
        actions={auth.can("clients", "edit") ? <AddClientButton /> : undefined}
      />
      <Card>
        <div className="flex flex-col gap-3 border-b border-line p-4 lg:flex-row lg:items-center lg:justify-between">
          <FilterChips
            active={filter}
            chips={[
              chip("all", "All"),
              chip("active", "Active"),
              chip("pending", "Pending"),
              ...(showMoney ? [chip("high", "High Value")] : []),
              chip("prospect", "Prospect"),
              chip("hold", "On Hold"),
              chip("inactive", "Inactive"),
            ]}
          />
          <div className="flex flex-col gap-2 sm:flex-row">
            <SelectFilter param="service" label="Service type" placeholder="All services" options={SERVICES} />
            <SearchBox placeholder="Name, PAN, GSTIN, mobile, email" className="sm:w-72" />
          </div>
        </div>
        <DataTable
          rows={pg.slice}
          rowKey={(r) => r.id}
          caption="Client list"
          empty={<EmptyState icon={<Users className="h-5.5 w-5.5" />} title="No clients match" description="Try a different filter or search term." />}
          columns={[
            {
              key: "name",
              header: "Client",
              cell: (c) => (
                <Link href={`/clients/${c.id}`} className="group flex items-center gap-3">
                  <Avatar name={c.name} size="sm" />
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-ink group-hover:underline">{c.name}</span>
                    <span className="block truncate text-xs text-ink-3">
                      {c.code} · {c.constitution ?? "—"} · {c.city ?? ""}
                    </span>
                  </span>
                </Link>
              ),
            },
            { key: "ids", header: "PAN / GSTIN", cell: (c) => <span className="tnum block text-[13px] text-ink-2">{c.gstin ?? c.pan ?? "—"}</span>, hideBelow: "lg" },
            { key: "mobile", header: "Mobile", cell: (c) => <span className="tnum text-[13px] text-ink-2">{c.mobile ?? "—"}</span>, hideBelow: "xl" },
            {
              key: "services",
              header: "Services",
              cell: (c) => (
                <div className="flex max-w-60 flex-wrap gap-1">
                  {c.services.slice(0, 4).map((s) => (
                    <Badge key={s} className="h-5 px-2 text-[11px]">{s}</Badge>
                  ))}
                  {c.services.length > 4 && <Badge className="h-5 px-2 text-[11px]">+{c.services.length - 4}</Badge>}
                </div>
              ),
              hideBelow: "lg",
            },
            { key: "work", header: "Pending", align: "center", cell: (c) => (c.pendingWork + c.pendingDocs > 0 ? <span className="tnum text-[13px] text-ink-2">{c.pendingWork} work · {c.pendingDocs} docs</span> : <span className="text-ink-4">—</span>) },
            ...(showMoney
              ? [{ key: "outstanding", header: "Outstanding", align: "right" as const, cell: (c: (typeof rows)[number]) => (c.outstanding ? <span className={`tnum font-medium ${c.overdue ? "text-danger" : "text-ink"}`}>{formatINR(c.outstanding)}</span> : <span className="text-ink-4">—</span>) }]
              : []),
            { key: "status", header: "Status", cell: (c) => <StatusBadge status={c.status} /> },
          ]}
          mobileCard={(c) => (
            <Link href={`/clients/${c.id}`} className="flex items-center gap-3">
              <Avatar name={c.name} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{c.name}</p>
                <p className="tnum truncate text-xs text-ink-3">{c.gstin ?? c.pan ?? c.code}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <StatusBadge status={c.status} />
                  {c.pendingWork > 0 && <Badge tone="warn">{c.pendingWork} pending</Badge>}
                </div>
              </div>
              {showMoney && c.outstanding > 0 && <span className={`tnum text-sm font-semibold ${c.overdue ? "text-danger" : ""}`}>{formatINR(c.outstanding)}</span>}
            </Link>
          )}
        />
        <Pagination {...pg} noun="clients" href={(p) => withParams("/clients", { ...base, filter: sp.filter }, { page: p > 1 ? String(p) : undefined })} />
      </Card>
      <ClientModals
        canEdit={auth.can("clients", "edit")}
        staff={staffOptions(auth.firm.id)}
        defaultFy={financialYearOf(todayISO())}
        editing={editing ? { ...editing } : null}
      />
    </div>
  );
}
