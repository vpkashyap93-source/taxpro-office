import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { Eye, Globe, Lock } from "lucide-react";
import { db, schema as s } from "@/db";
import { requireStaff } from "@/server/auth";
import { listClients } from "@/server/queries/clients";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { DataTable } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PortalAccessButton } from "@/components/admin/portal-access";
import { formatDateTime } from "@/lib/dates";

export const metadata = { title: "Client Portal" };

export default async function ClientPortalAdmin() {
  const auth = await requireStaff("portal");
  const clients = listClients(auth.firm.id).filter((c) => c.status !== "Inactive");
  const logins = db.select().from(s.users).where(and(eq(s.users.firmId, auth.firm.id), eq(s.users.role, "Client"))).all();
  const loginFor = (id: string) => logins.find((l) => l.clientId === id);
  const canEdit = auth.can("portal", "edit");
  return (
    <div className="space-y-6">
      <PageHeader title="Client Portal" description="Give clients a secure login to see their compliance status, pending documents, bills and payments — and upload documents themselves." />
      <div className="grid gap-4 md:grid-cols-3">
        {[
          { icon: <Globe className="h-4 w-4" />, title: "What clients see", text: "Profile, compliance status, pending documents (with upload), bills, payments, reports and notices." },
          { icon: <Lock className="h-4 w-4" />, title: "Private by design", text: "Each client sees only their own records. Staff notes, other clients and firm finances are never exposed." },
          { icon: <Eye className="h-4 w-4" />, title: "Preview anytime", text: "Use Preview to see exactly what a client sees before sharing access." },
        ].map((f) => (
          <Card key={f.title}><CardBody className="pt-5"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-navy-50 text-navy-700">{f.icon}</span><p className="mt-3 text-sm font-semibold">{f.title}</p><p className="mt-1 text-[13px] text-ink-3">{f.text}</p></CardBody></Card>
        ))}
      </div>
      <Card>
        <CardHeader title="Portal access" subtitle={`${logins.filter((l) => l.active).length} of ${clients.length} clients enabled · Demo login: abc@client.demo`} />
        <DataTable
          rows={clients}
          rowKey={(c) => c.id}
          caption="Client portal access"
          columns={[
            { key: "c", header: "Client", cell: (c) => <Link href={`/clients/${c.id}`} className="font-medium hover:underline">{c.name}</Link> },
            { key: "login", header: "Login", cell: (c) => <span className="text-[13px] text-ink-2">{loginFor(c.id)?.email ?? "—"}</span>, hideBelow: "lg" },
            { key: "status", header: "Access", cell: (c) => { const l = loginFor(c.id); return <Badge tone={l?.active ? "ok" : "neutral"} dot>{l ? (l.active ? "Enabled" : "Disabled") : "Not enabled"}</Badge>; } },
            { key: "last", header: "Last visit", cell: (c) => <span className="text-[13px] text-ink-3">{loginFor(c.id)?.lastLoginAt ? formatDateTime(loginFor(c.id)!.lastLoginAt) : "—"}</span>, hideBelow: "xl" },
            { key: "prev", header: <span className="sr-only">Preview</span>, cell: (c) => <Link href={`/client-portal/preview/${c.id}`} className="inline-flex items-center gap-1 text-[13px] font-medium text-navy-600 hover:underline"><Eye className="h-3.5 w-3.5" /> Preview</Link> },
            { key: "act", header: <span className="sr-only">Actions</span>, align: "right", cell: (c) => (canEdit ? <PortalAccessButton clientId={c.id} clientName={c.name} email={loginFor(c.id)?.email ?? c.email} enabled={!!loginFor(c.id)?.active} /> : null) },
          ]}
          mobileCard={(c) => (
            <div className="flex items-center justify-between gap-3">
              <div><p className="text-sm font-semibold">{c.name}</p><Link href={`/client-portal/preview/${c.id}`} className="text-xs text-navy-600">Preview portal</Link></div>
              {canEdit && <PortalAccessButton clientId={c.id} clientName={c.name} email={loginFor(c.id)?.email ?? c.email} enabled={!!loginFor(c.id)?.active} />}
            </div>
          )}
        />
      </Card>
    </div>
  );
}
