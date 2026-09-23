import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { Mail, MessageCircle, Phone, Plus, FileText, ListChecks, ClipboardCheck, Wallet, Pencil } from "lucide-react";
import { requireStaff } from "@/server/auth";
import { getClientProfile, type ClientProfile } from "@/server/queries/clients";
import { staffOptions } from "@/server/queries/common";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Tabs } from "@/components/ui/tabs";
import { DataTable } from "@/components/ui/table";
import { PriorityBadge, StatusBadge } from "@/components/ui/status-badge";
import { AssigneeChip, Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { DueLabel } from "@/components/ui/due";
import { EmptyState } from "@/components/ui/states";
import { LinkButton } from "@/components/ui/button";
import { ClientModals } from "@/components/clients/clients-toolbar";
import { DeleteClientButton } from "@/components/clients/delete-client";
import { formatINR } from "@/lib/money";
import { financialYearOf, formatDate, formatDateTime, fyRange, todayISO } from "@/lib/dates";
import { dscBucket } from "@/lib/dsc";
import { periodKeyLabel } from "@/lib/recurring";
import { formatBytes } from "@/lib/format";
import { readParams, type SearchParams } from "@/lib/params";
import { whatsappLink } from "@/lib/share";

export const metadata = { title: "Client profile" };

const TABS = ["overview", "compliance", "billing", "payments", "documents", "tasks", "cma", "notices", "dsc", "activity"] as const;
const TAB_LABEL: Record<(typeof TABS)[number], string> = { overview: "Overview", compliance: "Compliance", billing: "Billing", payments: "Payments", documents: "Documents", tasks: "Tasks", cma: "CMA", notices: "Notices", dsc: "DSC", activity: "Activity" };

export default async function ClientProfilePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SearchParams }) {
  const auth = await requireStaff("clients");
  const { id } = await params;
  const sp = await readParams(searchParams);
  const p = getClientProfile(auth.firm.id, id);
  if (!p) notFound();
  const { client: c } = p;
  const today = todayISO();
  const fy = financialYearOf(today);
  const money = auth.can("billing");
  const visibleTabs = TABS.filter((t) => {
    if (t === "billing") return auth.can("billing");
    if (t === "payments") return auth.can("payments");
    if (t === "compliance") return auth.can("compliance");
    if (t === "documents") return auth.can("documents");
    if (t === "tasks") return auth.can("tasks");
    if (t === "cma") return auth.can("cma");
    if (t === "notices") return auth.can("notices");
    if (t === "dsc") return auth.can("dsc");
    return true;
  });
  const tab = (visibleTabs as readonly string[]).includes(sp.tab ?? "") ? (sp.tab as (typeof TABS)[number]) : "overview";
  const counts: Partial<Record<(typeof TABS)[number], number>> = {
    compliance: p.compliance.filter((x) => x.status !== "Filed" && x.status !== "Completed").length,
    billing: p.invoices.length,
    payments: p.payments.length,
    documents: p.checklists.reduce((a, x) => a + x.pending, 0),
    tasks: p.tasks.filter((t) => t.status !== "Completed").length,
    cma: p.cma.length,
    notices: p.notices.filter((n) => n.status !== "Closed").length,
    dsc: p.dsc.length,
  };
  const outstanding = p.invoices.reduce((a, i) => a + i.outstanding, 0);
  const overdue = p.invoices.filter((i) => i.status === "Overdue").reduce((a, i) => a + i.outstanding, 0);
  const { start } = fyRange(fy);
  const billedFy = p.invoices.filter((i) => i.invoiceDate >= start && i.storedStatus !== "Draft" && i.storedStatus !== "Cancelled").reduce((a, i) => a + i.total, 0);
  const openWork = p.compliance.filter((x) => x.status !== "Filed" && x.status !== "Completed");
  const pendingDocs = p.checklists.reduce((a, x) => a + x.pending, 0);
  const canEdit = auth.can("clients", "edit");

  return (
    <div className="space-y-6">
      <nav aria-label="Breadcrumb" className="text-[13px] text-ink-3">
        <Link href="/clients" className="hover:text-ink hover:underline">Clients</Link> <span aria-hidden>/</span> <span className="text-ink-2">{c.name}</span>
      </nav>

      {/* Profile header */}
      <Card>
        <div className="flex flex-col gap-5 p-5 md:p-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <Avatar name={c.name} size="lg" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold tracking-[-0.02em] md:text-2xl">{c.name}</h1>
                <StatusBadge status={c.status} />
              </div>
              <p className="mt-0.5 text-sm text-ink-3">
                {[c.tradeName && c.tradeName !== c.name ? c.tradeName : null, c.code, c.constitution, c.businessType, c.city].filter(Boolean).join(" · ")}
              </p>
              <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-[13px]">
                {[["PAN", c.pan], ["GSTIN", c.gstin], ["TAN", c.tan], ["UDYAM", c.udyam]].map(([k, v]) =>
                  v ? (
                    <div key={k} className="flex gap-1.5">
                      <dt className="text-ink-3">{k}</dt>
                      <dd className="tnum font-medium text-ink">{v}</dd>
                    </div>
                  ) : null,
                )}
              </dl>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {p.services.map((s) => (
                  <Badge key={s} tone="info">{s}</Badge>
                ))}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 lg:justify-end">
            {c.mobile && (
              <>
                <LinkButton href={`tel:+91${c.mobile}`} variant="secondary" size="sm" icon={<Phone className="h-3.5 w-3.5" />}>Call</LinkButton>
                <LinkButton href={whatsappLink(c.mobile, `Hello ${c.name}, this is ${auth.firm.name}.`)} target="_blank" rel="noopener noreferrer" variant="secondary" size="sm" icon={<MessageCircle className="h-3.5 w-3.5" />}>WhatsApp</LinkButton>
              </>
            )}
            {c.email && <LinkButton href={`mailto:${c.email}`} variant="secondary" size="sm" icon={<Mail className="h-3.5 w-3.5" />}>Email</LinkButton>}
            {canEdit && <LinkButton href={`/clients/${c.id}?edit=${c.id}&tab=${tab}`} scroll={false} variant="primary" size="sm" icon={<Pencil className="h-3.5 w-3.5" />}>Edit</LinkButton>}
          </div>
        </div>
        <div className="grid grid-cols-2 border-t border-line md:grid-cols-5">
          {[
            ...(money ? [{ label: "Outstanding", value: formatINR(outstanding), tone: overdue ? "text-danger" : "text-ink", sub: overdue ? `${formatINR(overdue)} overdue` : "Nothing overdue" }] : []),
            ...(money ? [{ label: `Billed FY ${fy}`, value: formatINR(billedFy), tone: "text-ink", sub: `${p.invoices.length} invoices` }] : []),
            ...(money ? [{ label: "Monthly fee", value: p.recurring?.active ? formatINR(p.recurring.amount) : "—", tone: "text-ink", sub: p.recurring ? `${p.recurring.frequency} · ${p.recurring.active ? "ON" : "OFF"}` : "No recurring plan" }] : []),
            { label: "Pending work", value: String(openWork.length), tone: openWork.some((w) => w.dueDate < today) ? "text-danger" : "text-ink", sub: `${openWork.filter((w) => w.dueDate < today).length} overdue` },
            { label: "Documents pending", value: String(pendingDocs), tone: pendingDocs ? "text-warn" : "text-ink", sub: `${p.checklists.length} checklists` },
          ].map((m) => (
            <div key={m.label} className="border-line px-5 py-3.5 not-last:border-r max-md:[&:nth-child(2n)]:border-r-0 max-md:border-b">
              <p className="text-xs text-ink-3">{m.label}</p>
              <p className={`tnum mt-0.5 text-lg font-semibold ${m.tone}`}>{m.value}</p>
              <p className="text-xs text-ink-4">{m.sub}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-2">
        {auth.can("billing", "edit") && <LinkButton href={`/billing/invoices/new?client=${c.id}`} variant="secondary" size="sm" icon={<FileText className="h-3.5 w-3.5" />}>Create Bill</LinkButton>}
        {auth.can("payments", "edit") && <LinkButton href={`/payments?new=1&client=${c.id}`} variant="secondary" size="sm" icon={<Wallet className="h-3.5 w-3.5" />}>Record Payment</LinkButton>}
        {auth.can("compliance", "edit") && <LinkButton href={`/compliance?new=1&client=${c.id}`} variant="secondary" size="sm" icon={<ClipboardCheck className="h-3.5 w-3.5" />}>New Compliance</LinkButton>}
        {auth.can("tasks", "edit") && <LinkButton href={`/tasks?new=1&client=${c.id}`} variant="secondary" size="sm" icon={<ListChecks className="h-3.5 w-3.5" />}>Add Task</LinkButton>}
        {auth.can("documents", "edit") && <LinkButton href={`/documents?new=1&client=${c.id}`} variant="secondary" size="sm" icon={<Plus className="h-3.5 w-3.5" />}>Request Documents</LinkButton>}
      </div>

      <Tabs active={tab} items={visibleTabs.map((t) => ({ key: t, label: TAB_LABEL[t], href: `/clients/${c.id}?tab=${t}`, count: counts[t] }))} />

      {tab === "overview" && (
        <div className="grid gap-6 xl:grid-cols-3">
          <div className="space-y-6 xl:col-span-2">
            <Card>
              <CardHeader title="Open work" subtitle="Compliance not yet completed or filed" />
              <WorkTable rows={openWork.slice(0, 8)} today={today} />
            </Card>
            <Card>
              <CardHeader title="Profile" />
              <CardBody>
                <dl className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
                  <Detail label="Mobile" value={c.mobile} />
                  <Detail label="Email" value={c.email} />
                  <Detail label="Address" value={[c.address, c.city, c.state].filter(Boolean).join(", ")} />
                  <Detail label="Relationship manager" value={p.managerName} />
                  <Detail label="Financial year" value={c.financialYear} />
                  <Detail label="Client since" value={formatDate(c.createdAt)} />
                  <Detail label="Client portal" value={p.portalUser ? `${p.portalUser.email}${p.portalUser.active ? "" : " (disabled)"}` : "Not enabled"} />
                  {money && <Detail label="Recurring billing" value={p.recurring ? `${p.recurring.active ? "ON" : "OFF"} · ${p.recurring.items.map((i) => `${i.service} ${formatINR(i.amount)}`).join(", ")}` : "Not set up"} />}
                </dl>
                {c.notes && <p className="mt-4 rounded-lg bg-gold-50 px-3 py-2.5 text-[13px] text-ink-2 ring-1 ring-gold-100">{c.notes}</p>}
                {auth.user.role === "Admin" && <div className="mt-5 border-t border-line pt-4"><DeleteClientButton id={c.id} name={c.name} /></div>}
              </CardBody>
            </Card>
          </div>
          <Card>
            <CardHeader title="Timeline" subtitle="Complete client history" action={<Link href={`/clients/${c.id}?tab=activity`} className="text-[13px] font-medium text-navy-600 hover:underline">All</Link>} />
            <CardBody className="pt-1">
              <Timeline items={p.activity.slice(0, 10)} />
            </CardBody>
          </Card>
        </div>
      )}

      {tab === "compliance" && (
        <Card>
          <CardHeader title="Compliance" subtitle="All compliance work for this client" action={auth.can("compliance", "edit") ? <LinkButton size="sm" href={`/compliance?new=1&client=${c.id}`}>New</LinkButton> : undefined} />
          <WorkTable rows={p.compliance} today={today} />
        </Card>
      )}

      {tab === "billing" && (
        <Card>
          <CardHeader title="Invoices" action={auth.can("billing", "edit") ? <LinkButton size="sm" href={`/billing/invoices/new?client=${c.id}`}>Create Bill</LinkButton> : undefined} />
          <DataTable
            rows={p.invoices}
            rowKey={(r) => r.id}
            empty={<EmptyState title="No invoices yet" />}
            columns={[
              { key: "no", header: "Invoice No.", cell: (r) => <Link href={`/billing/invoices/${r.id}`} className="tnum font-medium hover:underline">{r.number}</Link> },
              { key: "period", header: "Billing Month", cell: (r) => periodKeyLabel(r.billingPeriod) },
              { key: "date", header: "Date", cell: (r) => <span className="tnum">{formatDate(r.invoiceDate)}</span>, hideBelow: "lg" },
              { key: "amount", header: "Amount", align: "right", cell: (r) => <span className="tnum">{formatINR(r.total)}</span> },
              { key: "paid", header: "Paid", align: "right", cell: (r) => <span className="tnum text-ink-2">{formatINR(r.paid)}</span>, hideBelow: "lg" },
              { key: "out", header: "Outstanding", align: "right", cell: (r) => <span className="tnum font-medium">{formatINR(r.outstanding)}</span> },
              { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
            ]}
            mobileCard={(r) => (
              <Link href={`/billing/invoices/${r.id}`} className="flex items-center justify-between gap-3">
                <div>
                  <p className="tnum text-sm font-medium">{r.number}</p>
                  <p className="text-xs text-ink-3">{periodKeyLabel(r.billingPeriod)} · {formatDate(r.invoiceDate)}</p>
                </div>
                <div className="text-right">
                  <p className="tnum text-sm font-semibold">{formatINR(r.total)}</p>
                  <StatusBadge status={r.status} />
                </div>
              </Link>
            )}
          />
        </Card>
      )}

      {tab === "payments" && (
        <Card>
          <CardHeader title="Payments received" action={auth.can("payments", "edit") ? <LinkButton size="sm" href={`/payments?new=1&client=${c.id}`}>Record Payment</LinkButton> : undefined} />
          <DataTable
            rows={p.payments}
            rowKey={(r) => r.id}
            empty={<EmptyState title="No payments recorded" />}
            columns={[
              { key: "date", header: "Date", cell: (r) => <span className="tnum">{formatDate(r.paymentDate)}</span> },
              { key: "inv", header: "Invoice", cell: (r) => (r.invoiceId ? <Link href={`/billing/invoices/${r.invoiceId}`} className="tnum hover:underline">{r.invoiceNumber}</Link> : "On account") },
              { key: "mode", header: "Mode", cell: (r) => r.mode },
              { key: "ref", header: "Reference", cell: (r) => <span className="tnum text-ink-2">{r.reference ?? "—"}</span>, hideBelow: "lg" },
              { key: "amt", header: "Amount", align: "right", cell: (r) => <span className="tnum font-medium text-brand">{formatINR(r.amount)}</span> },
            ]}
            mobileCard={(r) => (
              <div className="flex justify-between">
                <div>
                  <p className="text-sm font-medium">{r.invoiceNumber ?? "On account"}</p>
                  <p className="text-xs text-ink-3">{formatDate(r.paymentDate)} · {r.mode}</p>
                </div>
                <p className="tnum text-sm font-semibold text-brand">{formatINR(r.amount)}</p>
              </div>
            )}
          />
        </Card>
      )}

      {tab === "documents" && (
        <div className="space-y-4">
          {p.checklists.length === 0 && <Card><EmptyState title="No document requests yet" action={auth.can("documents", "edit") ? <LinkButton href={`/documents?new=1&client=${c.id}`}>Request documents</LinkButton> : undefined} /></Card>}
          {p.checklists.map((cl) => (
            <Card key={cl.id}>
              <CardHeader title={cl.title} subtitle={`${cl.category} · ${cl.pending} pending`} action={<Link href={`/documents?checklist=${cl.id}`} className="text-[13px] font-medium text-navy-600 hover:underline">Open</Link>} />
              <ul className="divide-y divide-line border-t border-line">
                {cl.items.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                    <span>{d.name}</span>
                    <span className="flex items-center gap-3">
                      {d.fileName && <span className="hidden text-xs text-ink-3 sm:inline">{d.fileName} · {formatBytes(d.sizeBytes)}</span>}
                      <StatusBadge status={d.status} />
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}

      {tab === "tasks" && (
        <Card>
          <CardHeader title="Tasks" action={auth.can("tasks", "edit") ? <LinkButton size="sm" href={`/tasks?new=1&client=${c.id}`}>Add Task</LinkButton> : undefined} />
          <DataTable
            rows={p.tasks}
            rowKey={(r) => r.id}
            empty={<EmptyState title="No tasks for this client" />}
            columns={[
              { key: "t", header: "Task", cell: (r) => <Link href={`/tasks?edit=${r.id}`} className="font-medium hover:underline">{r.title}</Link> },
              { key: "cat", header: "Category", cell: (r) => r.category, hideBelow: "lg" },
              { key: "due", header: "Due", cell: (r) => <DueLabel date={r.dueDate} done={r.status === "Completed"} today={today} /> },
              { key: "p", header: "Priority", cell: (r) => <PriorityBadge priority={r.priority} /> },
              { key: "s", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
              { key: "a", header: "Assigned To", cell: (r) => <AssigneeChip name={r.assigneeName} />, hideBelow: "lg" },
            ]}
            mobileCard={(r) => (
              <Link href={`/tasks?edit=${r.id}`} className="block">
                <p className="text-sm font-medium">{r.title}</p>
                <div className="mt-1.5 flex items-center gap-2"><StatusBadge status={r.status} /><DueLabel date={r.dueDate} done={r.status === "Completed"} today={today} /></div>
              </Link>
            )}
          />
        </Card>
      )}

      {tab === "cma" && (
        <Card>
          <CardHeader title="CMA cases" action={auth.can("cma", "edit") ? <LinkButton size="sm" href={`/cma/new?client=${c.id}`}>New CMA</LinkButton> : undefined} />
          <DataTable
            rows={p.cma}
            rowKey={(r) => r.id}
            empty={<EmptyState title="No CMA cases" />}
            columns={[
              { key: "p", header: "Purpose", cell: (r) => <Link href={`/cma/${r.id}`} className="font-medium hover:underline">{r.purpose}</Link> },
              { key: "b", header: "Bank", cell: (r) => r.bank ?? "—" },
              { key: "fy", header: "FY", cell: (r) => r.financialYear, hideBelow: "lg" },
              { key: "due", header: "Due", cell: (r) => <DueLabel date={r.dueDate} done={r.status === "Submitted"} today={today} /> },
              { key: "s", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
            ]}
            mobileCard={(r) => (
              <Link href={`/cma/${r.id}`} className="block">
                <p className="text-sm font-medium">{r.purpose}</p>
                <p className="text-xs text-ink-3">{r.bank}</p>
                <div className="mt-1.5"><StatusBadge status={r.status} /></div>
              </Link>
            )}
          />
        </Card>
      )}

      {tab === "notices" && (
        <Card>
          <CardHeader title="Notices" action={auth.can("notices", "edit") ? <LinkButton size="sm" href={`/notices?new=1&client=${c.id}`}>Add Notice</LinkButton> : undefined} />
          <DataTable
            rows={p.notices}
            rowKey={(r) => r.id}
            empty={<EmptyState title="No notices" />}
            columns={[
              { key: "t", header: "Notice", cell: (r) => <Link href={`/notices?edit=${r.id}`} className="font-medium hover:underline">{r.noticeType}</Link> },
              { key: "d", header: "Department", cell: (r) => r.department },
              { key: "sec", header: "Section", cell: (r) => r.section ?? "—", hideBelow: "lg" },
              { key: "due", header: "Reply due", cell: (r) => <DueLabel date={r.dueDate} done={r.status === "Closed" || r.status === "Reply Submitted"} today={today} /> },
              { key: "s", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
            ]}
            mobileCard={(r) => (
              <Link href={`/notices?edit=${r.id}`} className="block">
                <p className="text-sm font-medium">{r.noticeType}</p>
                <p className="text-xs text-ink-3">{r.department} · {r.section}</p>
                <div className="mt-1.5"><StatusBadge status={r.status} /></div>
              </Link>
            )}
          />
        </Card>
      )}

      {tab === "dsc" && (
        <Card>
          <CardHeader title="Digital Signature Certificates" action={auth.can("dsc", "edit") ? <LinkButton size="sm" href={`/dsc?new=1&client=${c.id}`}>Add DSC</LinkButton> : undefined} />
          <DataTable
            rows={p.dsc}
            rowKey={(r) => r.id}
            empty={<EmptyState title="No DSC records" />}
            columns={[
              { key: "h", header: "Holder", cell: (r) => <Link href={`/dsc?edit=${r.id}`} className="font-medium hover:underline">{r.holderName}</Link> },
              { key: "i", header: "Issued", cell: (r) => <span className="tnum">{formatDate(r.issueDate)}</span>, hideBelow: "lg" },
              { key: "e", header: "Expiry", cell: (r) => <span className="tnum">{formatDate(r.expiryDate)}</span> },
              { key: "b", header: "Validity", cell: (r) => <StatusBadge status={dscBucket(r.expiryDate, today)} /> },
              { key: "s", header: "Renewal", cell: (r) => <StatusBadge status={r.renewalStatus} /> },
            ]}
            mobileCard={(r) => (
              <Link href={`/dsc?edit=${r.id}`} className="flex justify-between">
                <div><p className="text-sm font-medium">{r.holderName}</p><p className="text-xs text-ink-3">Expires {formatDate(r.expiryDate)}</p></div>
                <StatusBadge status={dscBucket(r.expiryDate, today)} />
              </Link>
            )}
          />
        </Card>
      )}

      {tab === "activity" && (
        <Card>
          <CardHeader title="Activity" subtitle="Everything that happened with this client" />
          <CardBody>
            <Timeline items={p.activity} />
          </CardBody>
        </Card>
      )}

      <ClientModals canEdit={canEdit} staff={staffOptions(auth.firm.id)} defaultFy={fy} editing={sp.edit === c.id ? { ...c, services: p.services } : null} />
    </div>
  );
}

function Detail({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-ink-3">{label}</dt>
      <dd className="mt-0.5 text-ink">{value || <span className="text-ink-4">—</span>}</dd>
    </div>
  );
}

function WorkTable({ rows, today }: { rows: ClientProfile["compliance"]; today: string }) {
  return (
    <DataTable
      rows={rows}
      rowKey={(r) => r.id}
      empty={<EmptyState title="Nothing pending" description="All compliance work is completed or filed." />}
      columns={[
        { key: "type", header: "Work", cell: (r) => <Link href={`/compliance?edit=${r.id}`} className="font-medium hover:underline">{r.complianceType}</Link> },
        { key: "period", header: "Period", cell: (r) => r.period },
        { key: "due", header: "Due", cell: (r) => <DueLabel date={r.dueDate} done={r.status === "Filed" || r.status === "Completed"} today={today} /> },
        { key: "p", header: "Priority", cell: (r) => <PriorityBadge priority={r.priority} />, hideBelow: "xl" },
        { key: "s", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
        { key: "a", header: "Assigned To", cell: (r) => <AssigneeChip name={r.assigneeName} />, hideBelow: "lg" },
      ]}
      mobileCard={(r) => (
        <Link href={`/compliance?edit=${r.id}`} className="block">
          <div className="flex justify-between gap-3">
            <p className="text-sm font-medium">{r.complianceType} · {r.period}</p>
            <DueLabel date={r.dueDate} done={r.status === "Filed" || r.status === "Completed"} today={today} />
          </div>
          <div className="mt-1.5"><StatusBadge status={r.status} /></div>
        </Link>
      )}
    />
  );
}

function Timeline({ items }: { items: { id: string; summary: string; occurredAt: string; userName: string | null; entityType: string }[] }) {
  if (!items.length) return <EmptyState title="No activity yet" className="py-8" />;
  const dot: Record<string, string> = { payment: "bg-brand-500", invoice: "bg-navy-600", compliance: "bg-ok", document: "bg-gold-400", notice: "bg-danger", cma: "bg-review" };
  return (
    <ol className="relative ms-1.5 border-s border-line">
      {items.map((a) => (
        <li key={a.id} className="ms-5 pb-4 last:pb-0">
          <span className={`absolute -start-[5px] mt-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-surface ${dot[a.entityType] ?? "bg-ink-4"}`} aria-hidden />
          <p className="text-sm text-ink">{a.summary}</p>
          <p className="text-xs text-ink-3">
            {formatDateTime(a.occurredAt)}
            {a.userName && ` · ${a.userName}`}
          </p>
        </li>
      ))}
    </ol>
  );
}
