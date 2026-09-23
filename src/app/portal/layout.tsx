import Link from "next/link";
import { LogOut } from "lucide-react";
import { requireClientUser } from "@/server/auth";
import { signOut } from "@/server/actions/session";
import { LogoMark } from "@/components/layout/logo";
import { ToastProvider } from "@/components/ui/toast";
import { TAGLINE } from "@/components/layout/sidebar";

export const metadata = { title: "Client Portal" };

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const auth = await requireClientUser();
  return (
    <ToastProvider>
      <header className="no-print border-b border-line bg-navy-950 text-white">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3 sm:px-6">
          <Link href="/portal" className="flex items-center gap-2.5">
            <LogoMark className="h-8 w-8" />
            <span className="leading-tight">
              <span className="block text-sm font-semibold">{auth.firm.name}</span>
              <span className="block text-[11px] text-white/55">Client Portal</span>
            </span>
          </Link>
          <form action={signOut} className="ms-auto">
            <button type="submit" className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-white/80 hover:bg-white/10 hover:text-white">
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </form>
        </div>
      </header>
      <main className="print-shell mx-auto max-w-5xl px-4 py-6 sm:px-6">{children}</main>
      <footer className="no-print mx-auto max-w-5xl px-6 pb-8 text-center text-xs text-ink-4">{TAGLINE}</footer>
    </ToastProvider>
  );
}
