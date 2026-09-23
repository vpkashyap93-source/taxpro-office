import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { Eye } from "lucide-react";
import { db, schema as s } from "@/db";
import { requireStaff } from "@/server/auth";
import { PortalView } from "@/components/portal/portal-view";

export const metadata = { title: "Portal preview" };

export default async function PortalPreview({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const auth = await requireStaff("portal");
  const { id } = await params;
  const { tab } = await searchParams;
  const client = db.select().from(s.clients).where(and(eq(s.clients.id, id), eq(s.clients.firmId, auth.firm.id))).get();
  if (!client) notFound();
  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-info-line bg-info-bg px-4 py-3 text-sm text-info">
        <span className="flex items-center gap-2"><Eye className="h-4 w-4" /> Previewing the client portal as <strong>{client.name}</strong> — read-only.</span>
        <Link href="/client-portal" className="font-medium hover:underline">Exit preview</Link>
      </div>
      <PortalView firmId={auth.firm.id} clientId={id} tab={tab} base={`/client-portal/preview/${id}`} preview />
    </div>
  );
}
