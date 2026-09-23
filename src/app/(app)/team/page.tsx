import Link from "next/link";
import { and, eq, ne } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireStaff } from "@/server/auth";
import { openWork } from "@/server/queries/dashboard";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { DataTable } from "@/components/ui/table";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { AddMemberButton, PermissionMatrixEditor, TeamModals } from "@/components/admin/team-ui";
import { formatDateTime, todayISO } from "@/lib/dates";

export const metadata = { title: "Team Management" };

export default async function TeamPage() {
  const auth = await requireStaff("team");
  const canEdit = auth.can("team", "edit");
  const members = db.select().from(s.users).where(and(eq(s.users.firmId, auth.firm.id), ne(s.users.role, "Client"))).all().sort((a, b) => a.name.localeCompare(b.name));
  const work = openWork(auth.firm.id);
  const today = todayISO();
  return (
    <div className="space-y-6">
      <PageHeader title="Team Management" description="Staff, roles and what each role can access." actions={canEdit ? <AddMemberButton /> : undefined} />
      <Card>
        <DataTable
          rows={members}
          rowKey={(m) => m.id}
          caption="Team members"
          columns={[
            { key: "name", header: "Member", cell: (m) => <div className="flex items-center gap-3"><Avatar name={m.name} size="sm" /><div><p className="font-medium">{m.name}{m.id === auth.user.id && <span className="ms-1.5 text-xs text-ink-3">(you)</span>}</p><p className="text-xs text-ink-3">{m.email}</p></div></div> },
            { key: "role", header: "Role", cell: (m) => <Badge tone={m.role === "Admin" ? "gold" : m.role === "Billing Staff" ? "ok" : "info"}>{m.role}</Badge> },
            { key: "desig", header: "Designation", cell: (m) => <span className="text-ink-2">{m.designation ?? "—"}</span>, hideBelow: "lg" },
            { key: "work", header: "Open work", align: "center", cell: (m) => { const w = work.filter((x) => x.assigneeName === m.name); const o = w.filter((x) => x.dueDate < today).length; return <Link href={`/tasks?view=team&staff=${m.id}`} className="tnum hover:underline">{w.length}{o ? <span className="text-danger"> ({o} overdue)</span> : null}</Link>; } },
            { key: "login", header: "Last sign-in", cell: (m) => <span className="text-[13px] text-ink-3">{m.lastLoginAt ? formatDateTime(m.lastLoginAt) : "Never"}</span>, hideBelow: "xl" },
            { key: "status", header: "Status", cell: (m) => <Badge tone={m.active ? "ok" : "neutral"} dot>{m.active ? "Active" : "Inactive"}</Badge> },
            { key: "edit", header: <span className="sr-only">Edit</span>, align: "right", cell: (m) => (canEdit ? <Link href={`/team?edit=${m.id}`} scroll={false} className="text-[13px] font-medium text-navy-600 hover:underline">Edit</Link> : null) },
          ]}
          mobileCard={(m) => (
            <div className="flex items-center gap-3">
              <Avatar name={m.name} />
              <div className="min-w-0 flex-1"><p className="text-sm font-semibold">{m.name}</p><p className="text-xs text-ink-3">{m.role} · {m.designation}</p></div>
              {canEdit && <Link href={`/team?edit=${m.id}`} scroll={false} className="text-[13px] font-medium text-navy-600">Edit</Link>}
            </div>
          )}
        />
      </Card>
      <PermissionMatrixEditor initial={auth.permissions} canEdit={canEdit && auth.user.role === "Admin"} />
      <TeamModals canEdit={canEdit} members={members.map((m) => ({ id: m.id, name: m.name, email: m.email, phone: m.phone, role: m.role, designation: m.designation, active: m.active }))} />
    </div>
  );
}
