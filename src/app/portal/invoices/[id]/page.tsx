import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireClientUser } from "@/server/auth";
import { getInvoice } from "@/server/queries/invoices";
import { getBankSettings, getInvoiceSettings } from "@/server/settings";
import { InvoiceDocument } from "@/components/billing/invoice-document";
import { PrintButton } from "@/components/ui/print-button";

export default async function PortalInvoice({ params }: { params: Promise<{ id: string }> }) {
  const auth = await requireClientUser();
  const { id } = await params;
  const data = getInvoice(auth.firm.id, id);
  if (!data || data.invoice.clientId !== auth.user.clientId || data.invoice.status === "Draft") notFound();
  const firm = db.select().from(schema.firms).where(eq(schema.firms.id, auth.firm.id)).get()!;
  return (
    <div className="space-y-4">
      <div className="no-print flex items-center justify-between">
        <Link href="/portal?tab=bills" className="text-sm text-navy-600 hover:underline">← Back to bills</Link>
        <PrintButton label="Print / Save PDF" />
      </div>
      <InvoiceDocument inv={data.invoice} client={data.client} items={data.items} firm={firm} settings={getInvoiceSettings(auth.firm.id)} bank={getBankSettings(auth.firm.id)} paid={data.paid} outstanding={data.outstanding} />
    </div>
  );
}
