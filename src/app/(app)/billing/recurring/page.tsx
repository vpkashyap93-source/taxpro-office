import Link from "next/link";
import { FileText, Repeat } from "lucide-react";
import { requireStaff } from "@/server/auth";
import { listRecurring } from "@/server/queries/invoices";
import { clientOptions } from "@/server/queries/common";
import { getInvoiceSettings } from "@/server/settings";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { DataTable } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/states";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { EditPlanButton, NewPlanButton, RecurringModals, RecurringToggle } from "@/components/billing/recurring-list";
import { formatINR } from "@/lib/money";
import { addMonths, monthLabel, startOfMonth, todayISO } from "@/lib/dates";
import { periodLabel } from "@/lib/recurring";

export const metadata = { title: "Recurring Billing" };

export default async function RecurringPage() {
  const auth = await requireStaff("billing");
  const plans = listRecurring(auth.firm.id);
  const canEdit = auth.can("billing", "edit");
  const active = plans.filter((p) => p.active);
  const mrr = active.reduce((a, p) => a + p.amount / p.intervalMonths, 0);
  const withPlan = new Set(plans.map((p) => p.clientId));
  const allClients = clientOptions(auth.firm.id, { includeInactive: true });
  const settings = getInvoiceSettings(auth.firm.id);
  const today = todayISO();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={<Link href="/billing" className="hover:underline">Billing & Invoices</Link>}
        title="Recurring Billing"
        description="Monthly professional fees per client. Generate all bills for a month in one step — nothing is sent without your confirmation."
        actions={
          canEdit ? (
            <>
              <NewPlanButton />
              <LinkButton href="/billing/recurring/generate" variant="success" icon={<FileText className="h-4 w-4" />}>Generate Monthly Bills</LinkButton>
            </>
          ) : undefined
        }
      />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {[
          { label: "Active plans", value: String(active.length) },
          { label: "Monthly recurring fees", value: formatINR(Math.round(mrr)), sub: "before GST, normalised per month" },
          { label: "Paused plans", value: String(plans.length - active.length) },
          { label: "Clients without a plan", value: String(allClients.filter((c) => !withPlan.has(c.value)).length) },
        ].map((m) => (
          <div key={m.label} className="rounded-[var(--radius-card)] border border-line bg-surface px-4 py-3.5 shadow-[var(--shadow-card)] sm:px-5">
            <p className="text-[12.5px] font-medium text-ink-3">{m.label}</p>
            <p className="tnum mt-0.5 text-xl font-semibold [overflow-wrap:anywhere] sm:text-2xl">{m.value}</p>
            {m.sub && <p className="text-xs text-ink-4">{m.sub}</p>}
          </div>
        ))}
      </div>
      <Card>
        <DataTable
          rows={plans}
          rowKey={(p) => p.id}
          caption="Recurring billing plans"
          empty={<EmptyState icon={<Repeat className="h-5.5 w-5.5" />} title="No recurring plans yet" description="Set up monthly fees for your retainer clients." />}
          columns={[
            { key: "client", header: "Client", cell: (p) => <Link href={`/clients/${p.clientId}`} className="font-medium hover:underline">{p.clientName}</Link> },
            {
              key: "items",
              header: "Fee lines",
              cell: (p) => (
                <div className="flex flex-wrap gap-1">
                  {p.items.map((i) => (
                    <Badge key={i.id} className="h-5.5">
                      {i.service} <span className="tnum text-ink-3">{formatINR(i.amount)}</span>
                    </Badge>
                  ))}
                </div>
              ),
              hideBelow: "lg",
            },
            { key: "total", header: "Per period", align: "right", cell: (p) => <span className="tnum font-semibold">{formatINR(p.amount)}</span> },
            { key: "freq", header: "Frequency", cell: (p) => <span className="text-ink-2">{p.frequency}{p.frequency === "Custom" ? ` · ${p.intervalMonths} mo` : ""}</span> },
            { key: "next", header: "Next period", cell: (p) => <span className="text-ink-2">{periodLabel(p.nextPeriodStart, p.intervalMonths)}</span>, hideBelow: "xl" },
            { key: "on", header: "Recurring", cell: (p) => <div className="flex items-center gap-2"><RecurringToggle id={p.id} active={p.active} disabled={!canEdit} /><span className="text-xs text-ink-3">{p.active ? "ON" : "OFF"}</span></div> },
            { key: "edit", header: <span className="sr-only">Edit</span>, align: "right", cell: (p) => (canEdit ? <EditPlanButton id={p.id} /> : null) },
          ]}
          mobileCard={(p) => (
            <div>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Link href={`/clients/${p.clientId}`} className="text-sm font-semibold">{p.clientName}</Link>
                  <p className="text-xs text-ink-3">{p.items.map((i) => `${i.service} ${formatINR(i.amount)}`).join(" · ")}</p>
                </div>
                <RecurringToggle id={p.id} active={p.active} disabled={!canEdit} />
              </div>
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="tnum font-semibold">{formatINR(p.amount)} <span className="text-xs font-normal text-ink-3">/ {p.frequency.toLowerCase()}</span></span>
                {canEdit && <EditPlanButton id={p.id} />}
              </div>
            </div>
          )}
        />
      </Card>
      {canEdit && (
        <RecurringModals
          plans={plans.map((p) => ({ id: p.id, clientId: p.clientId, active: p.active, frequency: p.frequency, intervalMonths: p.intervalMonths, nextPeriodStart: p.nextPeriodStart, dueDays: p.dueDays, gstRate: p.gstRate, notes: p.notes, items: p.items.map((i) => ({ service: i.service, description: i.description, amount: i.amount })) }))}
          clients={allClients.filter((c) => !withPlan.has(c.value))}
          allClients={allClients}
          defaultNext={startOfMonth(today)}
          defaultGst={settings.defaultGstRate}
          defaultDue={settings.defaultDueDays}
        />
      )}
      <p className="text-xs text-ink-3">Tip: the next period advances automatically after bills are generated for {monthLabel(addMonths(startOfMonth(today), 0), "long")}.</p>
    </div>
  );
}
