import Link from "next/link";
import { FileText, Plus, Repeat } from "lucide-react";
import { requireStaff } from "@/server/auth";
import { billingSummary, listInvoices, monthlySeries } from "@/server/queries/invoices";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { DataTable } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/states";
import { LinkButton } from "@/components/ui/button";
import { GroupedBarChart } from "@/components/ui/charts";
import { FilterChips, withParams } from "@/components/ui/filter-chips";
import { SearchBox, SelectFilter } from "@/components/ui/url-filters";
import { RowActions } from "@/components/billing/row-actions";
import { Pagination, paginate } from "@/components/ui/pagination";
import { DueLabel } from "@/components/ui/due";
import { formatINR } from "@/lib/money";
import { financialYearOf, fyRange, monthLabel, monthsBetween, shortMonth, todayISO } from "@/lib/dates";
import { periodKeyLabel } from "@/lib/recurring";
import { matches, readParams, type SearchParams } from "@/lib/params";
import { cn } from "@/lib/cn";

export const metadata = { title: "Billing & Invoices" };

const FILTERS = {
  all: { label: "All", test: () => true },
  unpaid: { label: "Unpaid", test: (s: string, out: number) => out > 0 },
  draft: { label: "Draft", test: (s: string) => s === "Draft" },
  sent: { label: "Sent", test: (s: string) => s === "Sent" },
  pending: { label: "Pending", test: (s: string) => s === "Generated" || s === "Sent" },
  partial: { label: "Partial", test: (s: string) => s === "Partially Paid" },
  overdue: { label: "Overdue", test: (s: string) => s === "Overdue" },
  paid: { label: "Paid", test: (s: string) => s === "Paid" },
  cancelled: { label: "Cancelled", test: (s: string) => s === "Cancelled" },
} as const;
type FilterKey = keyof typeof FILTERS;

export default async function BillingPage({ searchParams }: { searchParams: SearchParams }) {
  const auth = await requireStaff("billing");
  const sp = await readParams(searchParams);
  const today = todayISO();
  const fy = sp.fy && /^\d{4}-\d{2}$/.test(sp.fy) ? sp.fy : financialYearOf(today);
  const { start, end } = fyRange(fy);
  const summary = billingSummary(auth.firm.id, start, end < today ? end : today, today);
  const months = monthsBetween(start, end < today ? end : today).slice(-6);
  const series = monthlySeries(auth.firm.id, months);
  const all = listInvoices(auth.firm.id, { today });
  const status = (sp.status && sp.status in FILTERS ? sp.status : "all") as FilterKey;
  const rows = all
    .filter((i) => FILTERS[status].test(i.status, i.outstanding))
    .filter((i) => !sp.month || i.billingPeriod?.startsWith(sp.month) || (!i.billingPeriod && i.invoiceDate.startsWith(sp.month)))
    .filter((i) => matches(sp.q, i.clientName, i.number));
  const pg = paginate(rows, sp.page);
  const canEdit = auth.can("billing", "edit");
  const monthOptions = [...new Set(all.map((i) => (i.billingPeriod ?? i.invoiceDate).slice(0, 7)))].sort().reverse().map((m) => ({ value: m, label: monthLabel(m, "long") }));
  const fyOptions = [...new Set(all.map((i) => financialYearOf(i.invoiceDate)))].sort().reverse();
  const base = { q: sp.q, month: sp.month, fy: sp.fy };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Billing & Invoices"
        description={`Professional fees and collections · FY ${fy}`}
        actions={
          canEdit ? (
            <>
              <LinkButton href="/billing/recurring" variant="secondary" icon={<Repeat className="h-4 w-4" />}>Recurring Billing</LinkButton>
              <LinkButton href="/billing/recurring/generate" variant="success" icon={<FileText className="h-4 w-4" />}>Generate Monthly Bills</LinkButton>
              <LinkButton href="/billing/invoices/new" icon={<Plus className="h-4 w-4" />}>Create Invoice</LinkButton>
            </>
          ) : undefined
        }
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:col-span-4 xl:grid-cols-1">
          {[
            { label: "Invoices Generated", value: summary.generated, tone: "text-ink", href: withParams("/billing", base, {}) },
            { label: "Collected", value: summary.collected, tone: "text-brand", href: "/payments" },
            { label: "Outstanding", value: summary.outstanding, tone: "text-warn", sub: `${summary.unpaidCount} unpaid invoices`, href: withParams("/billing", base, { status: "unpaid" }) },
            { label: "Overdue", value: summary.overdue, tone: "text-danger", sub: `${summary.overdueCount} invoices past due`, href: withParams("/billing", base, { status: "overdue" }) },
          ].map((m) => (
            <Link key={m.label} href={m.href} className="rounded-[var(--radius-card)] border border-line bg-surface px-4 py-3.5 shadow-[var(--shadow-card)] transition hover:border-line-strong sm:px-5">
              <p className="text-[12.5px] font-medium text-ink-3">{m.label}</p>
              <p className={cn("tnum mt-0.5 text-xl font-semibold tracking-[-0.02em] [overflow-wrap:anywhere] sm:text-2xl", m.tone)}>{formatINR(m.value)}</p>
              {m.sub && <p className="text-xs text-ink-4">{m.sub}</p>}
            </Link>
          ))}
        </div>
        <Card className="xl:col-span-8">
          <CardHeader title="Monthly Billing & Collection" subtitle={`${monthLabel(months[0]!)} – ${monthLabel(months[months.length - 1]!)}`} action={fyOptions.length > 1 ? <SelectFilter param="fy" label="Financial year" placeholder="Current FY" options={fyOptions} /> : undefined} />
          <CardBody>
            <GroupedBarChart
              ariaLabel="Monthly billing and collection"
              height={260}
              data={series.map((m) => ({ label: shortMonth(m.month), values: { billed: m.billed, collected: m.collected } }))}
              series={[
                { key: "billed", label: "Monthly Billing", color: "var(--chart-billed)" },
                { key: "collected", label: "Monthly Collection", color: "var(--chart-collected)" },
              ]}
            />
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="Bill Tracker" subtitle={`${rows.length} of ${all.length} invoices`} />
        <div className="flex flex-col gap-3 border-b border-line px-4 pb-4 lg:flex-row lg:items-center lg:justify-between">
          <FilterChips
            active={status}
            chips={(Object.keys(FILTERS) as FilterKey[]).map((k) => ({
              key: k,
              label: FILTERS[k].label,
              href: withParams("/billing", base, { status: k === "all" ? undefined : k }),
              count: all.filter((i) => FILTERS[k].test(i.status, i.outstanding)).length,
            }))}
          />
          <div className="flex gap-2">
            <SelectFilter param="month" label="Billing month" placeholder="All months" options={monthOptions} />
            <SearchBox placeholder="Client or invoice no." className="min-w-0 flex-1 sm:w-60 sm:flex-none" />
          </div>
        </div>
        <DataTable
          rows={pg.slice}
          rowKey={(r) => r.id}
          caption="Bill tracker"
          rowClassName={(r) => (r.status === "Overdue" ? "bg-danger-bg/30" : undefined)}
          empty={<EmptyState title="No invoices match" description="Change the filter or create a new invoice." action={canEdit ? <LinkButton href="/billing/invoices/new">Create Invoice</LinkButton> : undefined} />}
          columns={[
            { key: "client", header: "Client", cell: (r) => <Link href={`/clients/${r.clientId}`} className="font-medium hover:underline">{r.clientName}</Link> },
            { key: "no", header: "Invoice No.", cell: (r) => <Link href={`/billing/invoices/${r.id}`} className="tnum whitespace-nowrap text-[13px] text-navy-600 hover:underline">{r.storedStatus === "Draft" ? "Draft" : r.number}</Link> },
            { key: "month", header: "Billing Month", cell: (r) => <span className="text-ink-2">{r.billingPeriod ? periodKeyLabel(r.billingPeriod) : monthLabel(r.invoiceDate)}</span>, hideBelow: "lg" },
            { key: "amount", header: "Amount", align: "right", cell: (r) => <span className="tnum">{formatINR(r.total)}</span> },
            { key: "due", header: "Due Date", cell: (r) => <DueLabel date={r.dueDate} done={r.outstanding === 0} today={today} />, hideBelow: "xl" },
            { key: "paid", header: "Paid", align: "right", cell: (r) => <span className="tnum text-ink-2">{r.paid ? formatINR(r.paid) : "—"}</span>, hideBelow: "lg" },
            { key: "out", header: "Outstanding", align: "right", cell: (r) => <span className={cn("tnum font-medium", r.outstanding ? (r.status === "Overdue" ? "text-danger" : "text-ink") : "text-ink-4")}>{r.outstanding ? formatINR(r.outstanding) : "—"}</span> },
            { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
            {
              key: "actions",
              header: <span className="sr-only">Actions</span>,
              align: "right",
              cell: (r) => (
                <RowActions
                  label={`Actions for ${r.number}`}
                  actions={[
                    { label: "View", href: `/billing/invoices/${r.id}` },
                    ...(canEdit && r.storedStatus !== "Cancelled" ? [{ label: "Edit", href: `/billing/invoices/${r.id}/edit` }] : []),
                    ...(canEdit && r.storedStatus !== "Draft" && r.storedStatus !== "Cancelled" ? [{ label: "Send", href: `/billing/invoices/${r.id}` }] : []),
                    ...(auth.can("payments", "edit") && r.outstanding > 0 ? [{ label: "Record Payment", href: `/payments?new=1&client=${r.clientId}&invoice=${r.id}` }] : []),
                    ...(canEdit && r.outstanding > 0 ? [{ label: "Reminder", href: `/billing/invoices/${r.id}` }] : []),
                    { label: "Download", href: `/billing/invoices/${r.id}?print=1` },
                  ]}
                />
              ),
            },
          ]}
          mobileCard={(r) => (
            <Link href={`/billing/invoices/${r.id}`} className="block">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{r.clientName}</p>
                  <p className="tnum text-xs text-ink-3">{r.storedStatus === "Draft" ? "Draft" : r.number} · {r.billingPeriod ? periodKeyLabel(r.billingPeriod) : monthLabel(r.invoiceDate)}</p>
                </div>
                <div className="text-right">
                  <p className="tnum text-sm font-semibold">{formatINR(r.total)}</p>
                  {r.outstanding > 0 && <p className="tnum text-xs text-danger">{formatINR(r.outstanding)} due</p>}
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <StatusBadge status={r.status} />
                <span className="text-xs"><DueLabel date={r.dueDate} done={r.outstanding === 0} today={today} /></span>
              </div>
            </Link>
          )}
        />
        <Pagination {...pg} noun="invoices" href={(p) => withParams("/billing", { ...base, status: sp.status }, { page: p > 1 ? String(p) : undefined })} />
        {rows.length > 0 && (
          <div className="flex flex-wrap justify-end gap-x-6 gap-y-1 border-t border-line px-5 py-3 text-[13px]">
            <span className="me-auto text-ink-3">All filtered invoices</span>
            <span className="text-ink-3">Total <strong className="tnum text-ink">{formatINR(rows.reduce((a, r) => a + (r.storedStatus === "Cancelled" ? 0 : r.total), 0))}</strong></span>
            <span className="text-ink-3">Paid <strong className="tnum text-brand">{formatINR(rows.reduce((a, r) => a + r.paid, 0))}</strong></span>
            <span className="text-ink-3">Outstanding <strong className="tnum text-danger">{formatINR(rows.reduce((a, r) => a + r.outstanding, 0))}</strong></span>
          </div>
        )}
      </Card>
    </div>
  );
}
