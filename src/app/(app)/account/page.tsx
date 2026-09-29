import { requireStaff } from "@/server/auth";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Avatar } from "@/components/ui/avatar";
import { PasswordForm } from "@/components/admin/settings-forms";
import { MODULE_LABELS, MODULES } from "@/lib/permissions";

export const metadata = { title: "My Account" };

export default async function AccountPage() {
  const auth = await requireStaff();
  return (
    <div className="space-y-6">
      <PageHeader title="My Account" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Profile" />
          <CardBody>
            <div className="flex items-center gap-4">
              <Avatar name={auth.user.name} size="lg" />
              <div>
                <p className="text-lg font-semibold">{auth.user.name}</p>
                <p className="text-sm text-ink-3">{auth.user.email}</p>
                <p className="text-sm text-ink-3">{auth.user.designation ?? auth.user.role} · {auth.firm.name}</p>
              </div>
            </div>
            <p className="mt-5 mb-2 text-xs font-semibold tracking-[0.08em] text-ink-3 uppercase">Your access ({auth.user.role})</p>
            <ul className="grid grid-cols-2 gap-1 text-[13px]">
              {MODULES.map((m) => {
                const l = auth.can(m, "edit") ? "Edit" : auth.can(m) ? "View" : "—";
                return <li key={m} className="flex justify-between rounded px-2 py-1 odd:bg-subtle"><span className="text-ink-2">{MODULE_LABELS[m]}</span><span className={l === "Edit" ? "text-brand" : l === "View" ? "text-info" : "text-ink-4"}>{l}</span></li>;
              })}
            </ul>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Change password" />
          <CardBody><PasswordForm /></CardBody>
        </Card>
      </div>
    </div>
  );
}
