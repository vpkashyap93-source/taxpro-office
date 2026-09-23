import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { MODULE_LABELS, type Module } from "@/lib/permissions";

export const metadata = { title: "Access restricted" };

export default async function Forbidden({ searchParams }: { searchParams: Promise<{ module?: string }> }) {
  const { module } = await searchParams;
  const label = module && module in MODULE_LABELS ? MODULE_LABELS[module as Module] : "this page";
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-warn-bg text-warn">
        <ShieldAlert className="h-6 w-6" />
      </span>
      <h1 className="text-xl font-semibold">Access restricted</h1>
      <p className="max-w-sm text-sm text-ink-3">Your role doesn&apos;t include access to {label}. Ask your firm administrator to update your permissions in Team Management.</p>
      <Link href="/dashboard" className="mt-2 rounded-lg bg-navy-900 px-4 py-2 text-sm font-medium text-white">Back to dashboard</Link>
    </div>
  );
}
