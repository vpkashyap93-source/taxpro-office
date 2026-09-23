import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireStaff } from "@/server/auth";
import { clientOptions, staffOptions } from "@/server/queries/common";
import { PageHeader } from "@/components/ui/page-header";
import { CmaEditor } from "@/components/cma/cma-editor";
import { parseCmaInputs } from "@/lib/cma";

export const metadata = { title: "Edit CMA" };

export default async function EditCmaPage({ params }: { params: Promise<{ id: string }> }) {
  const auth = await requireStaff("cma", "edit");
  const { id } = await params;
  const r = db.select().from(s.cmaRecords).where(and(eq(s.cmaRecords.id, id), eq(s.cmaRecords.firmId, auth.firm.id))).get();
  if (!r) notFound();
  return (
    <div>
      <PageHeader eyebrow={<Link href={`/cma/${id}`} className="hover:underline">{r.purpose}</Link>} title="Edit CMA" />
      <CmaEditor initial={{ ...r, inputs: parseCmaInputs(r.inputs) }} clients={clientOptions(auth.firm.id, { includeInactive: true })} staff={staffOptions(auth.firm.id)} />
    </div>
  );
}
