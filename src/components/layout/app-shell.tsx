"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useTransition, type ReactNode } from "react";
import {
  Bell,
  CircleHelp,
  ClipboardCheck,
  CreditCard,
  FileStack,
  FileText,
  Home,
  ListChecks,
  LogOut,
  Menu,
  Plus,
  Search,
  Settings,
  UserPlus,
  Users,
  X,
  CheckCheck,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/dates";
import { markAllNotificationsRead, markNotificationRead, signOut } from "@/server/actions/session";
import { Avatar } from "@/components/ui/avatar";
import { ToastProvider } from "@/components/ui/toast";
import { GlobalSearch, MobileSearch } from "./global-search";
import { LogoMark, Wordmark } from "./logo";
import { QUICK_ACTIONS } from "./nav";
import { NavList, Sidebar, TAGLINE, isActive } from "./sidebar";
import { Popover } from "./popover";

export interface ShellNotification {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  href: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface ShellProps {
  user: { name: string; email: string; role: string; designation: string | null };
  firmName: string;
  allowed: string[];
  quickActions: string[];
  notifications: ShellNotification[];
  unread: number;
  children: ReactNode;
}

export function AppShell(props: ShellProps) {
  const [mobileSearch, setMobileSearch] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [quick, setQuick] = useState(false);
  const pathname = usePathname();

  // Close overlays on navigation.
  useEffect(() => {
    setDrawer(false);
    setQuick(false);
  }, [pathname]);

  return (
    <ToastProvider>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[80] focus:rounded-lg focus:bg-navy-900 focus:px-4 focus:py-2 focus:text-white">
        Skip to content
      </a>
      <Sidebar allowed={props.allowed} firmName={props.firmName} />
      <div className="lg:ps-[260px]">
        {/* Desktop header */}
        <header className="no-print sticky top-0 z-20 hidden h-16 items-center gap-4 border-b border-line bg-surface/90 px-6 backdrop-blur-md lg:flex">
          <GlobalSearch />
          <div className="ms-auto flex items-center gap-1.5">
            <NotificationsMenu items={props.notifications} unread={props.unread} />
            <Link href="/help" className="rounded-lg p-2 text-ink-3 hover:bg-subtle hover:text-ink" aria-label="Help">
              <CircleHelp className="h-5 w-5" />
            </Link>
            <ProfileMenu user={props.user} canSettings={props.allowed.includes("/settings")} />
          </div>
        </header>

        {/* Mobile header */}
        <header className="no-print sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-line bg-surface/95 px-3 backdrop-blur-md lg:hidden">
          <Link href="/dashboard" className="flex items-center gap-2" aria-label="TaxPro Office home">
            <LogoMark className="h-8 w-8" />
            <Wordmark tone="dark" />
          </Link>
          <div className="ms-auto flex items-center">
            <button type="button" onClick={() => setMobileSearch(true)} className="rounded-lg p-2 text-ink-2" aria-label="Search">
              <Search className="h-5 w-5" />
            </button>
            <NotificationsMenu items={props.notifications} unread={props.unread} />
            <ProfileMenu user={props.user} canSettings={props.allowed.includes("/settings")} compact />
          </div>
        </header>

        <main id="main" className="print-shell mx-auto w-full max-w-[1480px] px-4 pt-5 pb-28 sm:px-6 lg:px-8 lg:pt-7 lg:pb-12">
          {props.children}
        </main>
      </div>

      <MobileNav onPlus={() => setQuick(true)} onMore={() => setDrawer(true)} allowed={props.allowed} />
      {quick && <QuickAddSheet actions={props.quickActions} onClose={() => setQuick(false)} />}
      {drawer && <MoreDrawer allowed={props.allowed} firmName={props.firmName} onClose={() => setDrawer(false)} />}
      {mobileSearch && <MobileSearch onClose={() => setMobileSearch(false)} />}
    </ToastProvider>
  );
}

function NotificationsMenu({ items, unread }: { items: ShellNotification[]; unread: number }) {
  const router = useRouter();
  const [, start] = useTransition();
  return (
    <Popover
      label="Notifications"
      className="w-[min(92vw,380px)]"
      trigger={({ open, toggle }) => (
        <button type="button" onClick={toggle} aria-expanded={open} className="relative rounded-lg p-2 text-ink-3 hover:bg-subtle hover:text-ink" aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}>
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="tnum absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white ring-2 ring-surface">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      )}
    >
      {(close) => (
        <div>
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <p className="text-sm font-semibold">Notifications</p>
            {unread > 0 && (
              <button type="button" className="inline-flex items-center gap-1 text-xs font-medium text-navy-600 hover:underline" onClick={() => start(async () => { await markAllNotificationsRead(); router.refresh(); })}>
                <CheckCheck className="h-3.5 w-3.5" /> Mark all read
              </button>
            )}
          </div>
          <ul className="max-h-[60vh] divide-y divide-line overflow-y-auto">
            {items.length === 0 && <li className="px-4 py-10 text-center text-sm text-ink-3">You&apos;re all caught up.</li>}
            {items.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => {
                    close();
                    start(async () => {
                      if (!n.readAt) await markNotificationRead(n.id);
                      if (n.href) router.push(n.href);
                      else router.refresh();
                    });
                  }}
                  className={cn("flex w-full gap-3 px-4 py-3 text-left hover:bg-subtle", !n.readAt && "bg-navy-50/60")}
                >
                  <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", n.readAt ? "bg-transparent" : "bg-navy-600")} aria-hidden />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-ink">{n.title}</span>
                    {n.body && <span className="block truncate text-xs text-ink-3">{n.body}</span>}
                    <span className="mt-0.5 block text-[11px] text-ink-4">{formatDateTime(n.createdAt)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Popover>
  );
}

function ProfileMenu({ user, canSettings, compact }: { user: ShellProps["user"]; canSettings: boolean; compact?: boolean }) {
  return (
    <Popover
      label="Account"
      className="w-64"
      trigger={({ open, toggle }) => (
        <button type="button" onClick={toggle} aria-expanded={open} aria-label="Account menu" className="flex items-center gap-2.5 rounded-xl p-1 ps-1 hover:bg-subtle lg:pe-3">
          <Avatar name={user.name} size="sm" />
          {!compact && (
            <span className="hidden text-left leading-tight xl:block">
              <span className="block text-[13px] font-semibold text-ink">{user.name}</span>
              <span className="block text-[11.5px] text-ink-3">{user.role}</span>
            </span>
          )}
        </button>
      )}
    >
      {(close) => (
        <div className="p-1.5">
          <div className="px-3 py-2.5">
            <p className="text-sm font-semibold">{user.name}</p>
            <p className="truncate text-xs text-ink-3">{user.email}</p>
            <p className="mt-1 text-xs text-ink-3">{user.designation ?? user.role}</p>
          </div>
          <div className="my-1 h-px bg-line" />
          <Link onClick={close} href="/tasks?view=mine" className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-ink-2 hover:bg-subtle">
            <ListChecks className="h-4 w-4" /> My tasks
          </Link>
          {canSettings && (
            <Link onClick={close} href="/settings" className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-ink-2 hover:bg-subtle">
              <Settings className="h-4 w-4" /> Settings
            </Link>
          )}
          <Link onClick={close} href="/help" className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-ink-2 hover:bg-subtle">
            <CircleHelp className="h-4 w-4" /> Help & shortcuts
          </Link>
          <form action={signOut}>
            <button type="submit" className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-danger hover:bg-danger-bg">
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </form>
        </div>
      )}
    </Popover>
  );
}

function MobileNav({ onPlus, onMore, allowed }: { onPlus: () => void; onMore: () => void; allowed: string[] }) {
  const pathname = usePathname();
  const item = (href: string, label: string, Icon: typeof Home) => {
    const disabled = !allowed.includes(href);
    const on = isActive(pathname, href);
    if (disabled) return <span className="flex-1" />;
    return (
      <Link href={href} aria-current={on ? "page" : undefined} className={cn("flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium", on ? "text-navy-900" : "text-ink-3")}>
        <Icon className={cn("h-[22px] w-[22px]", on && "text-navy-900")} strokeWidth={on ? 2.2 : 1.8} />
        {label}
      </Link>
    );
  };
  return (
    <nav aria-label="Primary" className="no-print safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur-md lg:hidden">
      <div className="mx-auto flex max-w-lg items-end px-2">
        {item("/dashboard", "Home", Home)}
        {item("/clients", "Clients", Users)}
        <div className="flex flex-1 justify-center">
          <button type="button" onClick={onPlus} aria-label="Quick add" className="-mt-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-navy-900 text-white shadow-[var(--shadow-pop)] ring-4 ring-canvas active:scale-95">
            <Plus className="h-6 w-6" strokeWidth={2.4} />
          </button>
        </div>
        {item("/tasks", "Tasks", ListChecks)}
        <button type="button" onClick={onMore} className="flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium text-ink-3">
          <Menu className="h-[22px] w-[22px]" strokeWidth={1.8} />
          More
        </button>
      </div>
    </nav>
  );
}

const QUICK_ICONS: Record<string, typeof Plus> = {
  "Add Client": UserPlus,
  "Create Bill": FileText,
  "Add Task": ListChecks,
  "Add Payment": CreditCard,
  "Upload Document": FileStack,
  "New Compliance": ClipboardCheck,
};

function QuickAddSheet({ actions, onClose }: { actions: string[]; onClose: () => void }) {
  const list = QUICK_ACTIONS.filter((a) => actions.includes(a.href));
  return (
    <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Quick add">
      <button type="button" aria-label="Close" className="absolute inset-0 bg-navy-950/45 animate-fade-in" onClick={onClose} />
      <div className="safe-bottom absolute inset-x-0 bottom-0 animate-slide-up rounded-t-3xl bg-surface p-5 pb-8">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-line-strong" />
        <div className="mb-4 flex items-center justify-between">
          <p className="text-base font-semibold">Quick add</p>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-ink-3" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <ul className="grid grid-cols-3 gap-3">
          {list.map((a) => {
            const Icon = QUICK_ICONS[a.label] ?? Plus;
            return (
              <li key={a.href}>
                <Link href={a.href} className="flex flex-col items-center gap-2 rounded-2xl border border-line bg-subtle px-2 py-4 text-center text-[12.5px] font-medium text-ink active:bg-navy-50">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy-900 text-white">
                    <Icon className="h-5 w-5" />
                  </span>
                  {a.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function MoreDrawer({ allowed, firmName, onClose }: { allowed: string[]; firmName: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
      <button type="button" aria-label="Close menu" className="absolute inset-0 bg-navy-950/45 animate-fade-in" onClick={onClose} />
      <div className="absolute inset-y-0 right-0 flex w-[82%] max-w-xs animate-fade-in flex-col bg-navy-950">
        <div className="flex items-start justify-between px-5 pt-5 pb-3">
          <div>
            <div className="flex items-center gap-2.5">
              <LogoMark className="h-8 w-8" />
              <Wordmark />
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-white/45">{TAGLINE}</p>
            <p className="mt-2 text-xs text-white/70">{firmName}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-white/60" aria-label="Close menu">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-3 pb-6">
          <NavList allowed={allowed} onNavigate={onClose} />
        </div>
      </div>
    </div>
  );
}
