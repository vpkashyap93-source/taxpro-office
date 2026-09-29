import Link from "next/link";
import { Wallet } from "lucide-react";
import { PAYMENT_MODES } from "@/db/schema";
import { requireStaff } from "@/server/auth";
import { listInvoices, listPayments } from "@/server/queries/invoices";
import { clientOptions } from "@/server/queries/common";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { DataTable } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/states";
import { FilterChips, withParams } from "@/components/ui/filter-chips";
import { SearchBox, SelectFilter } from "@/components/ui/url-filters";
import { HBarList } from "@/components/ui/charts";
import { PaymentModalController, RecordPaymentButton } from "@/components/payments/payment-form";
import { DeletePaymentButton } from "@/components/billing/delete-payment";
import { Pagination, paginate } from "@/components/ui/pagination";
import { formatINR } from "@/lib/money";
import { endOfMonth, financialYearOf, formatDate, fyRange, startOfMonth, todayISO } from "@/lib/dates";
import { matches, readParams, type SearchParams } from "@/lib/params";

export const metadata = { title: "Payments" };

export default async function PaymentsPage({ searchParams }: { searchParams: SearchParams }) {
  const auth = await requireStaff("payments");
  const sp = await readParams(searchParams);
  const today = todayISO();
  const fy = fyRange(financialYearOf(today));
  const ranges = {
    month: { label: "This month", from: startOfMonth(today), to: endOfMonth(today) },
    fy: { label: `FY ${financialYearOf(today)}`, from: fy.start, to: fy.end },
    all: { label: "All time", from: undefined, to: undefined },
  } as const;
  const rangeKey = (sp.range && sp.range in ranges ? sp.range : "fy") as keyof typeof ranges;
  const range = ranges[rangeKey];
  const all = listPayments(auth.firm.id, { from: range.from, to: range.to });
  const rows = all.filter((p) => !sp.mode || p.mode === sp.mode).filter((p) => matches(sp.q, p.clientName, p.invoiceNumber, p.reference));
  const total = rows.reduce((a, p) => a + p.amount, 0);
  const byMode = PAYMENT_MODES.map((m) => ({ label: m, value: rows.filter((p) => p.mode === m).reduce((a, p) => a + p.amount, 0) })).filter((m) => m.value > 0).sort((a, b) => b.value - a.value);
  const canEdit = auth.can("payments", "edit");
  const openInvoices = listInvoices(auth.firm.id, { today })
    .filter((i) => i.outstanding > 0)
    .map((i) => ({ id: i.id, clientId: i.clientId, number: i.number, total: i.total, paid: i.paid, outstanding: i.outstanding, dueDate: i.dueDate }));
  const outstanding = openInvoices.reduce((a, i) => a + i.outstanding, 0);
  const base = { q: sp.q, mode: sp.mode };
  const pg = paginate(rows, sp.page);

  return (
    <div className="space-y-6">
      <PageHeader title="Payments" description="Every rupee received, against which bill." actions={canEdit ? <RecordPaymentButton /> : undefined} />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:col-span-5">
          {[
            { label: `Collected · ${range.label}`, value: formatINR(total), tone: "text-brand", sub: `${rows.length} payments` },
            { label: "Outstanding now", value: formatINR(outstanding), tone: "text-danger", sub: `${openInvoices.length} invoices`, href: "/billing?status=unpaid" },
            { label: "Average receipt", value: rows.length ? formatINR(Math.round(total / rows.length)) : "—", tone: "text-ink" },
            { label: "Partial payments", value: String(new Set(all.filter((p) => p.invoiceTotal && p.amount < p.invoiceTotal).map((p) => p.invoiceId)).size), tone: "text-ink", sub: "invoices paid in parts" },
          ].map((m) => {
            const body = (
              <>
                <p className="text-[12.5px] font-medium text-ink-3">{m.label}</p>
                <p className={`tnum mt-0.5 text-xl font-semibold [overflow-wrap:anywhere] sm:text-2xl ${m.tone}`}>{m.value}</p>
                {m.sub && <p className="text-xs text-ink-4">{m.sub}</p>}
              </>
            );
            const cls = "rounded-[var(--radius-card)] border border-line bg-surface px-4 py-3.5 shadow-[var(--shadow-card)] sm:px-5";
            return m.href ? <Link key={m.label} href={m.href} className={`${cls} hover:border-line-strong`}>{body}</Link> : <div key={m.label} className={cls}>{body}</div>;
          })}
        </div>
        <Card className="xl:col-span-7">
          <CardHeader title="Collection by payment mode" subtitle={range.label} />
          <CardBody>{byMode.length ? <HBarList data={byMode} color="var(--chart-collected)" /> : <EmptyState title="No payments in this period" className="py-6" />}</CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="Payment Tracker" subtitle={`${rows.length} payments`} />
        <div className="flex flex-col gap-3 border-b border-line px-4 pb-4 lg:flex-row lg:items-center lg:justify-between">
          <FilterChips active={rangeKey} chips={(Object.keys(ranges) as (keyof typeof ranges)[]).map((k) => ({ key: k, label: ranges[k].label, href: withParams("/payments", base, { range: k === "fy" ? undefined : k }) }))} />
          <div className="flex gap-2">
            <SelectFilter param="mode" label="Payment mode" placeholder="All modes" options={PAYMENT_MODES} />
            <SearchBox placeholder="Client, invoice or reference" className="min-w-0 flex-1 sm:w-64 sm:flex-none" />
          </div>
        </div>
        <DataTable
          rows={pg.slice}
          rowKey={(r) => r.id}
          caption="Payments"
          empty={<EmptyState icon={<Wallet className="h-5.5 w-5.5" />} title="No payments found" description="Try another period or filter." />}
          columns={[
            { key: "date", header: "Date", cell: (r) => <span className="tnum">{formatDate(r.paymentDate)}</span> },
            { key: "client", header: "Client", cell: (r) => <Link href={`/clients/${r.clientId}`} className="font-medium hover:underline">{r.clientName}</Link> },
            { key: "inv", header: "Invoice", cell: (r) => (r.invoiceId ? <Link href={`/billing/invoices/${r.invoiceId}`} className="tnum text-[13px] text-navy-600 hover:underline">{r.invoiceNumber}</Link> : <span className="text-ink-3">On account</span>) },
            { key: "mode", header: "Mode", cell: (r) => r.mode },
            { key: "ref", header: "Reference", cell: (r) => <span className="tnum text-[13px] text-ink-2">{r.reference ?? "—"}</span>, hideBelow: "xl" },
            { key: "amt", header: "Amount", align: "right", cell: (r) => <span className="tnum font-semibold text-brand">{formatINR(r.amount)}</span> },
            ...(canEdit ? [{ key: "del", header: <span className="sr-only">Delete</span>, align: "right" as const, cell: (r: (typeof rows)[number]) => <DeletePaymentButton id={r.id} /> }] : []),
          ]}
          mobileCard={(r) => (
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{r.clientName}</p>
                <p className="tnum text-xs text-ink-3">{formatDate(r.paymentDate)} · {r.mode} · {r.invoiceNumber ?? "On account"}</p>
              </div>
              <p className="tnum text-sm font-semibold text-brand">{formatINR(r.amount)}</p>
            </div>
          )}
        />
        <Pagination {...pg} noun="payments" href={(p) => withParams("/payments", { ...base, range: sp.range }, { page: p > 1 ? String(p) : undefined })} />
      </Card>
      {canEdit && <PaymentModalController clients={clientOptions(auth.firm.id)} invoices={openInvoices} today={today} />}
    </div>
  );
}
