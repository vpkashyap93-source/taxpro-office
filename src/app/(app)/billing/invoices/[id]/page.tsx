import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/server/auth";
import { getInvoice } from "@/server/queries/invoices";
import { getBankSettings, getInvoiceSettings } from "@/server/settings";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/states";
import { InvoiceActions } from "@/components/billing/invoice-actions";
import { DeletePaymentButton } from "@/components/billing/delete-payment";
import { AutoPrint } from "@/components/billing/auto-print";
import { InvoiceDocument } from "@/components/billing/invoice-document";
import { formatINR } from "@/lib/money";
import { formatDate, formatDateTime, todayISO, diffDays } from "@/lib/dates";
import { periodKeyLabel } from "@/lib/recurring";
import { mailtoLink, whatsappLink } from "@/lib/share";

export const metadata = { title: "Invoice" };

export default async function InvoicePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ print?: string }> }) {
  const auth = await requireStaff("billing");
  const { id } = await params;
  const { print } = await searchParams;
  const data = getInvoice(auth.firm.id, id);
  if (!data) notFound();
  const { invoice: inv, client, items, payments, paid, outstanding, status } = data;
  const firm = db.select().from(schema.firms).where(eq(schema.firms.id, auth.firm.id)).get()!;
  const settings = getInvoiceSettings(auth.firm.id);
  const bank = getBankSettings(auth.firm.id);
  const today = todayISO();
  const period = periodKeyLabel(inv.billingPeriod);
  const isDraft = inv.status === "Draft";

  const msg = `Dear ${client.name},\n\nPlease find invoice ${inv.number} dated ${formatDate(inv.invoiceDate)}${period !== "—" ? ` for ${period}` : ""} for ${formatINR(inv.total)}, due on ${formatDate(inv.dueDate)}.${bank?.upiId ? `\nUPI: ${bank.upiId}` : ""}${bank ? `\nBank: ${bank.bankName} A/c ${bank.accountNumber} IFSC ${bank.ifsc}` : ""}\n\nRegards,\n${firm.name}`;
  const reminder = `Dear ${client.name},\n\nThis is a gentle reminder that ${formatINR(outstanding)} is outstanding on invoice ${inv.number} (due ${formatDate(inv.dueDate)}). Kindly arrange the payment at your earliest convenience.${bank?.upiId ? `\nUPI: ${bank.upiId}` : ""}\n\nRegards,\n${firm.name}`;

  return (
    <div className="space-y-6">
      <AutoPrint enabled={print === "1"} />
      <div className="no-print flex flex-col gap-4">
        <div>
          <nav aria-label="Breadcrumb" className="text-[13px] text-ink-3">
            <Link href="/billing" className="hover:underline">Billing & Invoices</Link> / <span className="text-ink-2">{inv.number}</span>
          </nav>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <h1 className="tnum text-2xl font-semibold tracking-[-0.02em]">{isDraft ? "Draft invoice" : inv.number}</h1>
            <StatusBadge status={status} />
          </div>
          <p className="mt-1 text-sm text-ink-3">
            <Link href={`/clients/${client.id}`} className="hover:underline">{client.name}</Link> · {formatINR(inv.total)}
            {outstanding > 0 && !isDraft && <> · <span className={status === "Overdue" ? "text-danger" : "text-warn"}>{formatINR(outstanding)} outstanding</span></>}
          </p>
        </div>
        <InvoiceActions
          id={inv.id}
          status={inv.status}
          outstanding={outstanding}
          clientId={client.id}
          canEdit={auth.can("billing", "edit")}
          canPay={auth.can("payments", "edit")}
          hasPayments={payments.length > 0}
          share={{
            whatsapp: whatsappLink(client.mobile, msg),
            email: mailtoLink(client.email, `Invoice ${inv.number} from ${firm.name}`, msg),
            reminderWhatsapp: whatsappLink(client.mobile, reminder),
            reminderEmail: mailtoLink(client.email, `Payment reminder — ${inv.number}`, reminder),
          }}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_300px] 2xl:grid-cols-[1fr_340px]">
        {/* Printable invoice */}
        <InvoiceDocument inv={inv} client={client} items={items} firm={firm} settings={settings} bank={bank} paid={paid} outstanding={outstanding} />

        {/* Side panel */}
        <aside className="no-print space-y-6">
          <Card>
            <CardHeader title="Payment status" />
            <CardBody className="space-y-2 text-sm">
              <Row label="Invoice amount" value={formatINR(inv.total)} />
              <Row label="Paid" value={formatINR(paid)} tone="text-brand" />
              <Row label="Outstanding" value={formatINR(outstanding)} tone={outstanding ? "text-danger" : "text-ink"} strong />
              {outstanding > 0 && !isDraft && (
                <p className="pt-1 text-xs text-ink-3">{inv.dueDate < today ? `${diffDays(inv.dueDate, today)} days past due` : `Due in ${diffDays(today, inv.dueDate)} days`}</p>
              )}
              {inv.sentAt && <p className="pt-1 text-xs text-ink-3">Last shared {formatDateTime(inv.sentAt)}{inv.sentVia ? ` via ${inv.sentVia}` : ""}</p>}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Payments" subtitle="Partial payments are supported" />
            {payments.length === 0 ? (
              <EmptyState title="No payments yet" className="py-6" />
            ) : (
              <ul className="divide-y divide-line border-t border-line">
                {payments.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2 px-5 py-3 text-sm">
                    <div>
                      <p className="tnum font-medium text-brand">{formatINR(p.amount)}</p>
                      <p className="text-xs text-ink-3">{formatDate(p.paymentDate)} · {p.mode}{p.reference ? ` · ${p.reference}` : ""}</p>
                    </div>
                    {auth.can("payments", "edit") && <DeletePaymentButton id={p.id} />}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </aside>
      </div>
    </div>
  );
}

function Row({ label, value, tone = "text-ink", strong }: { label: string; value: string; tone?: string; strong?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-ink-3">{label}</span>
      <span className={`tnum ${tone} ${strong ? "font-semibold" : ""}`}>{value}</span>
    </div>
  );
}
