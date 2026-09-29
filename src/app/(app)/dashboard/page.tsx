import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  ClipboardList,
  FileStack,
  FileText,
  IndianRupee,
  Leaf,
  Plus,
  Users,
  Wallet,
} from "lucide-react";
import { requireStaff } from "@/server/auth";
import { dashboardData } from "@/server/queries/dashboard";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { KpiCard } from "@/components/ui/kpi-card";
import { DataTable } from "@/components/ui/table";
import { PriorityBadge, StatusBadge } from "@/components/ui/status-badge";
import { AssigneeChip, Avatar } from "@/components/ui/avatar";
import { DueLabel } from "@/components/ui/due";
import { GroupedBarChart, TrendChart } from "@/components/ui/charts";
import { ProgressBar, RingMeter } from "@/components/ui/progress";
import { EmptyState } from "@/components/ui/states";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { formatINR, formatINRCompact } from "@/lib/money";
import { formatDate, greeting, longDate, shortMonth } from "@/lib/dates";
import { pluralize } from "@/lib/format";
import { periodKeyLabel } from "@/lib/recurring";
import { cn } from "@/lib/cn";

export const metadata = { title: "Dashboard" };

const CATEGORY_COLORS: Record<string, string> = {
  Compliance: "bg-navy-600",
  CMA: "bg-review",
  "DSC Expiry": "bg-gold-400",
  Notice: "bg-danger",
  "Bill Due": "bg-brand-500",
};

export default async function DashboardPage() {
  const auth = await requireStaff("dashboard");
  const d = dashboardData(auth);
  const firstName = auth.user.name.split(" ")[0];

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[13px] font-medium text-ink-3">{longDate(d.today)}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-[-0.02em] md:text-[28px]">
            {greeting()}, {firstName} <span aria-hidden>👋</span>
          </h1>
          <p className="mt-1 text-sm text-ink-3">
            {d.kpis.pendingWork > 0 ? (
              <>
                You have <strong className="font-semibold text-ink">{pluralize(d.kpis.pendingWork, "item")}</strong> due today or overdue
                {d.kpis.overdueWork > 0 && <> — <span className="font-medium text-danger">{d.kpis.overdueWork} overdue</span></>}.
              </>
            ) : (
              "Nothing is overdue. A good day to get ahead."
            )}
          </p>
        </div>
        <div className="hidden flex-wrap gap-2 md:flex">
          {auth.can("tasks", "edit") && (
            <LinkButton href="/tasks?new=1" variant="secondary" icon={<Plus className="h-4 w-4" />}>
              Add Task
            </LinkButton>
          )}
          {auth.can("billing", "edit") && (
            <LinkButton href="/billing/recurring/generate" variant="success" icon={<FileText className="h-4 w-4" />}>
              Generate Monthly Bills
            </LinkButton>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className={cn("grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3", d.finance ? "min-[85rem]:grid-cols-6" : "xl:grid-cols-4")}>
        <KpiCard href="/clients" label="Total Clients" value={d.kpis.totalClients} caption={`${d.kpis.activeClients} active`} icon={<Users className="h-4.5 w-4.5" />} />
        <KpiCard href="/compliance?due=pending" label="Pending Work" value={d.kpis.pendingWork} caption={d.kpis.overdueWork ? `${d.kpis.overdueWork} overdue` : "Due today"} icon={<ClipboardList className="h-4.5 w-4.5" />} accent={d.kpis.overdueWork ? "danger" : "warn"} />
        {d.finance && (
          <KpiCard href="/billing?status=unpaid" label="Unpaid Bills" value={formatINR(d.kpis.unpaid)} caption={`${pluralize(d.kpis.unpaidCount, "invoice")} outstanding`} icon={<IndianRupee className="h-4.5 w-4.5" />} accent="danger" />
        )}
        {d.finance && (
          <KpiCard href="/payments?range=month" label="This Month Collection" value={formatINR(d.kpis.monthCollection)} caption={`Billed ${formatINRCompact(d.kpis.monthBilled)} this month`} icon={<Wallet className="h-4.5 w-4.5" />} accent="brand" />
        )}
        <KpiCard href="/documents?status=pending" label="Documents Pending" value={d.kpis.docsPending} caption={`from ${pluralize(d.kpis.docsClients, "client")}`} icon={<FileStack className="h-4.5 w-4.5" />} accent="gold" />
        <KpiCard href="/compliance?due=week" label="Upcoming Due — 7 Days" value={d.kpis.upcoming7} caption="Compliance & tasks" icon={<CalendarClock className="h-4.5 w-4.5" />} accent="info" />
      </div>

      {/* Today's work + attention */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <Card className="xl:col-span-8">
          <CardHeader
            title="Today's Work"
            subtitle={`${pluralize(d.todaysTotal, "item")} due by tomorrow, overdue first`}
            action={
              <Link href="/compliance?due=pending" className="inline-flex items-center gap-1 text-[13px] font-medium text-navy-600 hover:underline">
                View all <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            }
          />
          <DataTable
            rows={d.todays}
            rowKey={(r) => `${r.kind}-${r.id}`}
            caption="Work due today and tomorrow"
            empty={<EmptyState title="All clear for today" description="No compliance work or tasks are due today or tomorrow." />}
            columns={[
              { key: "client", header: "Client", cell: (r) => (r.clientId ? <Link href={`/clients/${r.clientId}`} className="font-medium text-ink hover:underline">{r.clientName}</Link> : <span className="text-ink-3">Internal</span>) },
              { key: "work", header: "Work", cell: (r) => <span className="block max-w-56 text-ink-2">{r.work}</span> },
              { key: "due", header: "Due Date", cell: (r) => <DueLabel date={r.dueDate} today={d.today} /> },
              { key: "priority", header: "Priority", cell: (r) => <PriorityBadge priority={r.priority} />, hideBelow: "2xl" },
              { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
              { key: "assignee", header: "Assigned To", cell: (r) => <AssigneeChip name={r.assigneeName} />, hideBelow: "lg" },
              { key: "action", header: <span className="sr-only">Action</span>, align: "right", cell: (r) => <Link href={r.href} className="text-[13px] font-medium text-navy-600 hover:underline">View</Link> },
            ]}
            mobileCard={(r) => (
              <Link href={r.href} className="block">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{r.clientName ?? "Internal"}</p>
                    <p className="truncate text-[13px] text-ink-2">{r.work}</p>
                  </div>
                  <DueLabel date={r.dueDate} today={d.today} />
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <StatusBadge status={r.status} />
                  <PriorityBadge priority={r.priority} />
                  <span className="ms-auto text-xs"><AssigneeChip name={r.assigneeName} /></span>
                </div>
              </Link>
            )}
          />
        </Card>

        <Card className="xl:col-span-4">
          <CardHeader title="Needs Attention" subtitle="Clients to follow up with today" icon={<AlertTriangle className="h-4 w-4" />} />
          <CardBody className="pt-0">
            {d.needsAttention.length === 0 ? (
              <EmptyState title="No clients need attention" className="py-8" />
            ) : (
              <ul className="divide-y divide-line">
                {d.needsAttention.map((c) => (
                  <li key={c.id}>
                    <Link href={`/clients/${c.id}`} className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-subtle">
                      <Avatar name={c.name} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{c.name}</p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {c.reasons.map((r) => (
                            <Badge key={r} tone={r.startsWith("Overdue") || r === "Open notice" ? "danger" : "warn"} className="h-5 px-2 text-[11px]">
                              {r}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 shrink-0 text-ink-4" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Billing + compliance */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        {d.finance && d.summaryFY && (
          <Card className="xl:col-span-8">
            <CardHeader
              title="Billing & Collection"
              subtitle={`Financial year ${d.fy} to date`}
              action={<LinkButton href="/billing" variant="ghost" size="sm">Open billing</LinkButton>}
            />
            <CardBody>
              <dl className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
                {[
                  { label: "Invoices Generated", value: d.summaryFY.generated, tone: "text-ink" },
                  { label: "Collected", value: d.summaryFY.collected, tone: "text-brand" },
                  { label: "Outstanding", value: d.summaryFY.outstanding, tone: "text-warn" },
                  { label: "Overdue", value: d.summaryFY.overdue, tone: "text-danger" },
                ].map((m) => (
                  <div key={m.label} className="rounded-xl border border-line bg-subtle px-3.5 py-3">
                    <dt className="text-xs text-ink-3">{m.label}</dt>
                    <dd className={cn("tnum mt-0.5 text-lg font-semibold tracking-[-0.01em] [overflow-wrap:anywhere]", m.tone)}>{formatINR(m.value)}</dd>
                  </div>
                ))}
              </dl>
              <GroupedBarChart
                ariaLabel="Monthly billing and collection for the last six months"
                data={d.series.map((m) => ({ label: shortMonth(m.month), values: { billed: m.billed, collected: m.collected } }))}
                series={[
                  { key: "billed", label: "Monthly Billing", color: "var(--chart-billed)" },
                  { key: "collected", label: "Monthly Collection", color: "var(--chart-collected)" },
                ]}
              />
            </CardBody>
          </Card>
        )}
        <Card className={d.finance ? "xl:col-span-4" : "xl:col-span-12"}>
          <CardHeader
            title="Compliance Overview"
            subtitle={`Work due so far in FY ${d.fy} that is done`}
            action={<LinkButton href="/compliance" variant="ghost" size="sm">Filter</LinkButton>}
          />
          <CardBody>
            {d.complianceProgress.length === 0 ? (
              <EmptyState title="No compliance work yet" />
            ) : (
              <ul className="space-y-4.5">
                {d.complianceProgress.map((c) => (
                  <li key={c.category}>
                    <Link href={`/compliance?category=${c.category}`} className="group block">
                      <div className="mb-1.5 flex items-baseline justify-between text-sm">
                        <span className="font-medium text-ink group-hover:underline">{c.category} Filing</span>
                        <span className="tnum text-ink-2">
                          <strong className="font-semibold text-ink">{c.pct}%</strong>
                          <span className="ms-1.5 text-xs text-ink-4">
                            {c.done}/{c.total}
                          </span>
                        </span>
                      </div>
                      <ProgressBar value={c.pct} tone={c.pct >= 75 ? "brand" : c.pct >= 50 ? "navy" : "warn"} label={`${c.category} completion`} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Lists */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
        {d.finance && (
          <Card>
            <CardHeader title="Overdue Bills" subtitle="Largest balances first" action={<Link href="/billing?status=overdue" className="text-[13px] font-medium text-navy-600 hover:underline">All</Link>} />
            <CardBody className="pt-0">
              {d.overdueBills.length === 0 ? (
                <EmptyState title="No overdue bills" description="Every invoice is within its due date." className="py-8" />
              ) : (
                <ul className="divide-y divide-line">
                  {d.overdueBills.map((b) => (
                    <li key={b.id}>
                      <Link href={`/billing/invoices/${b.id}`} className="-mx-2 flex items-center justify-between gap-3 rounded-lg px-2 py-2.5 hover:bg-subtle">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{b.clientName}</p>
                          <p className="text-xs text-ink-3">
                            {b.number} · {periodKeyLabel(b.billingPeriod) !== "—" ? periodKeyLabel(b.billingPeriod) : formatDate(b.invoiceDate)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="tnum text-sm font-semibold">{formatINR(b.outstanding)}</p>
                          <p className="text-xs text-danger">{b.days} days overdue</p>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        )}

        <Card>
          <CardHeader title="Documents Pending" subtitle="Clients who haven't sent everything" action={<Link href="/documents?status=pending" className="text-[13px] font-medium text-navy-600 hover:underline">All</Link>} />
          <CardBody className="pt-0">
            {d.pendingDocs.length === 0 ? (
              <EmptyState title="All documents received" className="py-8" />
            ) : (
              <ul className="divide-y divide-line">
                {d.pendingDocs.map((c) => (
                  <li key={c.id}>
                    <Link href={`/documents?checklist=${c.id}`} className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-subtle">
                      <Avatar name={c.clientName} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{c.clientName}</p>
                        <p className="truncate text-xs text-ink-3">
                          {c.title} · {c.items.filter((i) => i.status === "Pending" || i.status === "Partial").map((i) => i.name).join(", ")}
                        </p>
                      </div>
                      <Badge tone="warn">{c.pending} pending</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card className={cn(!d.finance && "xl:col-span-2")}>
          <CardHeader title="Upcoming Deadlines" subtitle="Next 14 days" action={<Link href="/calendar" className="text-[13px] font-medium text-navy-600 hover:underline">Calendar</Link>} />
          <CardBody className="pt-0">
            {d.deadlines.length === 0 ? (
              <EmptyState title="No deadlines in the next 14 days" className="py-8" />
            ) : (
              <ul className="space-y-1">
                {d.deadlines.map((e) => (
                  <li key={e.id}>
                    <Link href={e.href} className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-subtle">
                      <div className="flex w-11 shrink-0 flex-col items-center rounded-lg border border-line bg-subtle py-1">
                        <span className="text-[10px] font-semibold uppercase text-ink-3">{formatDate(e.date, { year: false }).split(" ")[1]}</span>
                        <span className="tnum text-[15px] leading-none font-semibold">{e.date.slice(8)}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{e.title}</p>
                        <p className="flex items-center gap-1.5 truncate text-xs text-ink-3">
                          <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", CATEGORY_COLORS[e.category] ?? "bg-ink-4")} aria-hidden />
                          {e.category} · <DueLabel date={e.date} today={d.today} />
                        </p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Trend, top clients, team */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-12">
        {d.finance && (
          <Card className="lg:col-span-2 xl:col-span-5">
            <CardHeader title="Revenue Trend" subtitle="Billed per month, last six months" />
            <CardBody>
              <TrendChart ariaLabel="Revenue billed per month" data={d.series.map((m) => ({ label: shortMonth(m.month), value: m.billed }))} />
            </CardBody>
          </Card>
        )}
        {d.finance && (
          <Card className="xl:col-span-4">
            <CardHeader title="Top Clients" subtitle={`By billing, FY ${d.fy}`} />
            <CardBody className="pt-0">
              {d.topClients.length === 0 ? (
                <EmptyState title="No billing yet this year" className="py-8" />
              ) : (
                <ol className="space-y-3">
                  {d.topClients.map((c, i) => {
                    const max = d.topClients[0]!.billed || 1;
                    return (
                      <li key={c.id}>
                        <Link href={`/clients/${c.id}`} className="group block">
                          <div className="flex items-baseline justify-between gap-3 text-sm">
                            <span className="flex min-w-0 items-center gap-2">
                              <span className="tnum w-4 text-xs text-ink-4">{i + 1}</span>
                              <span className="truncate font-medium group-hover:underline">{c.name}</span>
                            </span>
                            <span className="tnum font-semibold">{formatINR(c.billed)}</span>
                          </div>
                          <div className="ms-6 mt-1.5 h-1.5 rounded-full bg-subtle">
                            <div className="h-1.5 rounded-full bg-navy-600" style={{ width: `${(c.billed / max) * 100}%` }} />
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ol>
              )}
            </CardBody>
          </Card>
        )}
        <Card className={cn(d.finance ? "xl:col-span-3" : "lg:col-span-2 xl:col-span-12")}>
          <CardHeader title="Team Workload" subtitle="Open work per person" action={auth.can("tasks") ? <Link href="/tasks?view=team" className="text-[13px] font-medium text-navy-600 hover:underline">Tasks</Link> : undefined} />
          <CardBody className="pt-0">
            <ul className="divide-y divide-line">
              {d.team.map((m) => (
                <li key={m.id} className="flex items-center gap-3 py-2.5">
                  <Avatar name={m.name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{m.name}</p>
                    <p className="text-xs text-ink-3">{m.role}</p>
                  </div>
                  <div className="text-right text-xs">
                    <p className="tnum text-sm font-semibold">{m.open}</p>
                    {m.overdue > 0 ? <p className="text-danger">{m.overdue} overdue</p> : <p className="text-ink-4">open</p>}
                  </div>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </div>

      {/* Eco impact */}
      <section aria-labelledby="eco" className="overflow-hidden rounded-[var(--radius-card)] border border-ok-line bg-gradient-to-br from-brand-50 to-surface">
        <div className="flex flex-col gap-6 p-5 md:flex-row md:items-center md:p-6">
          <div className="md:w-64">
            <p id="eco" className="flex items-center gap-2 text-[15px] font-semibold text-brand-800">
              <Leaf className="h-4.5 w-4.5" /> Paperless Practice
            </p>
            <p className="mt-1 text-[13px] text-ink-3">Measured from your actual records in TaxPro Office.</p>
          </div>
          <div className="grid flex-1 grid-cols-2 gap-4 md:grid-cols-4">
            <EcoStat ring={d.paperless.digitalDocsPct} label="Digital Documents" sub={`${d.paperless.digitalDocs} files stored digitally`} />
            <EcoStat ring={d.paperless.digitalBillsPct} label="Digital Bills" sub={`${d.paperless.digitalBills} sent via WhatsApp/email`} />
            <div className="flex min-w-0 items-center gap-3">
              <span className="tnum flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-surface text-lg font-semibold text-brand ring-6 ring-brand-100">{d.paperless.reports}</span>
              <div className="min-w-0">
                <p className="text-sm font-medium">Digital Reports</p>
                <p className="text-xs text-ink-3">CMA & exported reports</p>
              </div>
            </div>
            <div className="flex min-w-0 items-center gap-3">
              <span className="tnum flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-brand text-lg font-semibold text-white">{d.paperless.pagesSaved.toLocaleString("en-IN")}</span>
              <div className="min-w-0">
                <p className="text-sm font-medium">Pages Saved</p>
                <p className="text-xs text-ink-3">Est. 1 page per digital bill, document & report</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function EcoStat({ ring, label, sub }: { ring: number; label: string; sub: string }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <RingMeter value={ring} label={label} />
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-ink-3">{sub}</p>
      </div>
    </div>
  );
}
