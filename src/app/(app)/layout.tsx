import { requireStaff } from "@/server/auth";
import { AppShell } from "@/components/layout/app-shell";
import { NAV_ITEMS, QUICK_ACTIONS } from "@/components/layout/nav";
import { listNotifications, syncNotifications, unreadCount } from "@/server/queries/notifications";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const auth = await requireStaff();
  syncNotifications(auth);
  const allowed = NAV_ITEMS.filter((n) => auth.can(n.module)).map((n) => n.href);
  const quickActions = QUICK_ACTIONS.filter((q) => auth.can(q.module, "edit")).map((q) => q.href);
  const notifications = listNotifications(auth.user.id).map((n) => ({ id: n.id, kind: n.kind, title: n.title, body: n.body, href: n.href, readAt: n.readAt, createdAt: n.createdAt }));
  return (
    <AppShell
      user={{ name: auth.user.name, email: auth.user.email, role: auth.user.role, designation: auth.user.designation }}
      firmName={auth.firm.name}
      allowed={allowed}
      quickActions={quickActions}
      notifications={notifications}
      unread={unreadCount(auth.user.id)}
    >
      {children}
    </AppShell>
  );
}
