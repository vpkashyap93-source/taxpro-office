import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireStaff } from "@/server/auth";
import { clientOptions } from "@/server/queries/common";
import { billingMonths, getInvoice, planMap } from "@/server/queries/invoices";
import { getInvoiceSettings } from "@/server/settings";
import { PageHeader } from "@/components/ui/page-header";
import { InvoiceForm } from "@/components/billing/invoice-form";
import { todayISO } from "@/lib/dates";

export const metadata = { title: "Edit Invoice" };

export default async function EditInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const auth = await requireStaff("billing", "edit");
  const { id } = await params;
  const data = getInvoice(auth.firm.id, id);
  if (!data) notFound();
  if (data.invoice.status === "Cancelled") redirect(`/billing/invoices/${id}`);
  const inv = data.invoice;
  return (
    <div>
      <PageHeader eyebrow={<Link href={`/billing/invoices/${id}`} className="hover:underline">{inv.number}</Link>} title="Edit Invoice" description={data.paid > 0 ? "Payments exist on this invoice — the total cannot go below the amount received." : undefined} />
      <InvoiceForm
        initial={{ id, number: inv.number, status: inv.status, clientId: inv.clientId, invoiceDate: inv.invoiceDate, dueDate: inv.dueDate, billingPeriod: inv.billingPeriod, gstRate: inv.gstRate, discount: inv.discount, notes: inv.notes, items: data.items.map((i) => ({ service: i.service, description: i.description, amount: i.amount })) }}
        clients={clientOptions(auth.firm.id, { includeInactive: true })}
        plans={planMap(auth.firm.id)}
        defaultDueDays={getInvoiceSettings(auth.firm.id).defaultDueDays}
        months={billingMonths(todayISO())}
      />
    </div>
  );
}
