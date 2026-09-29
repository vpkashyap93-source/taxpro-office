import Link from "next/link";
import { Bell, CheckCircle2, Clock, FileStack, FileText, MessageSquare, Wallet } from "lucide-react";
import { getClientProfile } from "@/server/queries/clients";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/states";
import { Tabs } from "@/components/ui/tabs";
import { DueLabel } from "@/components/ui/due";
import { PortalUploadButton } from "./portal-upload";
import { computeCma, parseCmaInputs } from "@/lib/cma";
import { formatMetric } from "@/lib/format";
import { formatINR } from "@/lib/money";
import { formatDate, todayISO } from "@/lib/dates";
import { periodKeyLabel } from "@/lib/recurring";

const TABS = [
  ["profile", "My Profile"],
  ["compliance", "My Compliance"],
  ["documents", "Pending Documents"],
  ["bills", "Bills"],
  ["payments", "Payments"],
  ["reports", "Reports"],
  ["notices", "Notices"],
  ["messages", "Messages"],
] as const;

/**
 * What a client sees in their portal. Rendered for the signed-in client (base "/portal")
 * or for staff previewing it (base "/client-portal/preview/<id>", read-only).
 */
export function PortalView({ firmId, clientId, tab: rawTab, base, preview }: { firmId: string; clientId: string; tab?: string; base: string; preview?: boolean }) {
  const p = getClientProfile(firmId, clientId);
  if (!p) return <EmptyState title="Client not found" />;
  const today = todayISO();
  const tab = TABS.some(([k]) => k === rawTab) ? rawTab! : "profile";
  const invoices = p.invoices.filter((i) => i.storedStatus !== "Draft" && i.storedStatus !== "Cancelled");
  const due = invoices.reduce((a, i) => a + i.outstanding, 0);
  const pendingDocs = p.checklists.flatMap((c) => c.items.filter((i) => i.status === "Pending" || i.status === "Partial").map((i) => ({ ...i, checklist: c.title, dueDate: c.dueDate })));
  const openWork = p.compliance.filter((c) => c.status !== "Filed" && c.status !== "Completed");
  const invoiceHref = (id: string) => (preview ? `/billing/invoices/${id}` : `/portal/invoices/${id}`);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {[
          { icon: <Clock className="h-4 w-4" />, label: "Work in progress", value: String(openWork.length), href: `${base}?tab=compliance` },
          { icon: <FileStack className="h-4 w-4" />, label: "Documents we need", value: String(pendingDocs.length), href: `${base}?tab=documents`, tone: pendingDocs.length ? "text-warn" : "" },
          { icon: <FileText className="h-4 w-4" />, label: "Amount due", value: formatINR(due), href: `${base}?tab=bills`, tone: due ? "text-danger" : "" },
          { icon: <CheckCircle2 className="h-4 w-4" />, label: "Returns filed this year", value: String(p.compliance.filter((c) => c.status === "Filed").length), href: `${base}?tab=compliance` },
        ].map((m) => (
          <Link key={m.label} href={m.href} scroll={false} className="rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-[var(--shadow-card)] hover:border-line-strong">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-navy-50 text-navy-700">{m.icon}</span>
            <p className="mt-3 text-xs text-ink-3">{m.label}</p>
            <p className={`tnum text-xl font-semibold [overflow-wrap:anywhere] ${m.tone ?? ""}`}>{m.value}</p>
          </Link>
        ))}
      </div>

      <Tabs active={tab} items={TABS.map(([k, l]) => ({ key: k, label: l, href: `${base}?tab=${k}`, count: k === "documents" ? pendingDocs.length : undefined }))} />

      {tab === "profile" && (
        <Card>
          <CardHeader title="My Profile" subtitle="If anything is incorrect, please inform your consultant." />
          <CardBody>
            <dl className="grid grid-cols-1 gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
              {[
                ["Name", p.client.name],
                ["Trade name", p.client.tradeName],
                ["PAN", p.client.pan],
                ["GSTIN", p.client.gstin],
                ["TAN", p.client.tan],
                ["Mobile", p.client.mobile],
                ["Email", p.client.email],
                ["Address", [p.client.address, p.client.city, p.client.state].filter(Boolean).join(", ")],
                ["Services", p.services.join(", ")],
                ["Your consultant", p.managerName],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-xs text-ink-3">{k}</dt>
                  <dd className="tnum mt-0.5">{v || "—"}</dd>
                </div>
              ))}
            </dl>
          </CardBody>
        </Card>
      )}

      {tab === "compliance" && (
        <Card>
          <CardHeader title="My Compliance" subtitle="Status of your returns and filings" />
          {p.compliance.length === 0 ? <EmptyState title="No compliance items yet" /> : (
            <ul className="divide-y divide-line border-t border-line">
              {p.compliance.slice().sort((a, b) => b.dueDate.localeCompare(a.dueDate)).map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
                  <div>
                    <p className="font-medium">{c.complianceType} · {c.period}</p>
                    <p className="text-xs text-ink-3">{c.status === "Filed" || c.status === "Completed" ? `Filed ${formatDate(c.filedDate)}${c.acknowledgement ? ` · Ack ${c.acknowledgement}` : ""}` : <>Due <DueLabel date={c.dueDate} today={today} /></>}</p>
                  </div>
                  <StatusBadge status={c.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {tab === "documents" && (
        <Card>
          <CardHeader title="Pending Documents" subtitle="Please upload these so we can complete your work on time." />
          {pendingDocs.length === 0 ? <EmptyState icon={<CheckCircle2 className="h-5.5 w-5.5 text-brand" />} title="Nothing pending — thank you!" /> : (
            <ul className="divide-y divide-line border-t border-line">
              {pendingDocs.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                  <div>
                    <p className="font-medium">{d.name}</p>
                    <p className="text-xs text-ink-3">{d.checklist}{d.dueDate ? ` · needed by ${formatDate(d.dueDate)}` : ""}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={d.status} />
                    <PortalUploadButton documentId={d.id} name={d.name} disabled={preview} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {tab === "bills" && (
        <Card>
          <CardHeader title="Bills" subtitle={due ? `${formatINR(due)} is due` : "All bills are paid — thank you!"} />
          {invoices.length === 0 ? <EmptyState title="No bills yet" /> : (
            <ul className="divide-y divide-line border-t border-line">
              {invoices.map((i) => (
                <li key={i.id}>
                  <Link href={invoiceHref(i.id)} className="flex items-center justify-between gap-3 px-5 py-3 text-sm hover:bg-subtle">
                    <div>
                      <p className="tnum font-medium">{i.number}</p>
                      <p className="text-xs text-ink-3">{i.billingPeriod ? periodKeyLabel(i.billingPeriod) : formatDate(i.invoiceDate)} · due {formatDate(i.dueDate)}</p>
                    </div>
                    <div className="text-right">
                      <p className="tnum font-semibold">{formatINR(i.total)}</p>
                      <StatusBadge status={i.status} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {tab === "payments" && (
        <Card>
          <CardHeader title="Payments" subtitle="Payments received by your consultant" icon={<Wallet className="h-4 w-4" />} />
          {p.payments.length === 0 ? <EmptyState title="No payments recorded" /> : (
            <ul className="divide-y divide-line border-t border-line">
              {p.payments.map((x) => (
                <li key={x.id} className="flex items-center justify-between px-5 py-3 text-sm">
                  <div><p className="font-medium">{formatDate(x.paymentDate)}</p><p className="text-xs text-ink-3">{x.mode} · {x.invoiceNumber ?? "On account"}</p></div>
                  <p className="tnum font-semibold text-brand">{formatINR(x.amount)}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {tab === "reports" && (
        <Card>
          <CardHeader title="Reports" subtitle="CMA and financial summaries prepared for you" />
          {p.cma.filter((c) => c.reportGeneratedAt).length === 0 ? <EmptyState title="No reports shared yet" description="Reports prepared by your consultant will appear here." /> : (
            <ul className="divide-y divide-line border-t border-line">
              {p.cma.filter((c) => c.reportGeneratedAt).map((c) => {
                const m = computeCma(parseCmaInputs(c.inputs));
                const g = (k: string) => { const x = m.find((y) => y.key === k)!; return formatMetric(x.value, x.format); };
                return (
                  <li key={c.id} className="px-5 py-3 text-sm">
                    <p className="font-medium">CMA — {c.purpose}</p>
                    <p className="text-xs text-ink-3">{c.bank} · prepared {formatDate(c.reportGeneratedAt!.slice(0, 10))} · Current ratio {g("currentRatio")} · DSCR {g("dscr")}</p>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      )}

      {tab === "notices" && (
        <Card>
          <CardHeader title="Notices" subtitle="Departmental notices your consultant is handling" icon={<Bell className="h-4 w-4" />} />
          {p.notices.length === 0 ? <EmptyState title="No notices" /> : (
            <ul className="divide-y divide-line border-t border-line">
              {p.notices.map((n) => (
                <li key={n.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                  <div><p className="font-medium">{n.department} — {n.noticeType}</p><p className="text-xs text-ink-3">Received {formatDate(n.noticeDate)}{n.dueDate ? ` · reply due ${formatDate(n.dueDate)}` : ""}</p></div>
                  <StatusBadge status={n.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {tab === "messages" && (
        <Card>
          <EmptyState
            icon={<MessageSquare className="h-5.5 w-5.5" />}
            title="Messaging is coming soon"
            description="Secure two-way messaging with your consultant is planned for a later release. For now, please use WhatsApp or email."
          />
        </Card>
      )}
    </div>
  );
}
