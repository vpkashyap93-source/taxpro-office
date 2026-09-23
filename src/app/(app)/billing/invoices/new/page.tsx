import Link from "next/link";
import { requireStaff } from "@/server/auth";
import { clientOptions } from "@/server/queries/common";
import { billingMonths, planMap } from "@/server/queries/invoices";
import { getInvoiceSettings } from "@/server/settings";
import { PageHeader } from "@/components/ui/page-header";
import { InvoiceForm } from "@/components/billing/invoice-form";
import { addMonths, startOfMonth, todayISO } from "@/lib/dates";
import { readParams, type SearchParams } from "@/lib/params";

export const metadata = { title: "Create Invoice" };

export default async function NewInvoicePage({ searchParams }: { searchParams: SearchParams }) {
  const auth = await requireStaff("billing", "edit");
  const sp = await readParams(searchParams);
  const today = todayISO();
  const settings = getInvoiceSettings(auth.firm.id);
  return (
    <div>
      <PageHeader
        eyebrow={<Link href="/billing" className="hover:underline">Billing & Invoices</Link>}
        title="Create Invoice"
        description="Professional fee invoice with GST. Save as draft or generate with the next invoice number."
      />
      <InvoiceForm
        initial={{ clientId: sp.client, invoiceDate: today, gstRate: settings.defaultGstRate, billingPeriod: addMonths(startOfMonth(today), -1).slice(0, 7) }}
        clients={clientOptions(auth.firm.id)}
        plans={planMap(auth.firm.id)}
        defaultDueDays={settings.defaultDueDays}
        months={billingMonths(today)}
      />
    </div>
  );
}
