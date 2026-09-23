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
import { LogoMark } from "@/components/layout/logo";
import { amountInWords, formatINR } from "@/lib/money";
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
  const intraState = !client.state || !firm.state || client.state === firm.state;
  const half = Math.round(inv.gstAmount / 2);
  const taxable = inv.subtotal - inv.discount;
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

      <div className="grid gap-6 xl:grid-cols-[1fr_300px] 2xl:grid-cols-[1fr_340px]">
        {/* Printable invoice */}
        <article className="print-area mx-auto w-full max-w-[860px] rounded-[var(--radius-card)] border border-line bg-surface p-6 shadow-[var(--shadow-card)] sm:p-10">
          {isDraft && <p className="mb-6 rounded-lg bg-warn-bg px-3 py-2 text-center text-xs font-semibold tracking-[0.12em] text-warn uppercase">Draft — not a valid tax invoice</p>}
          <header className="flex flex-col justify-between gap-6 border-b-2 border-navy-900 pb-6 sm:flex-row">
            <div className="flex gap-3">
              <LogoMark className="h-12 w-12 shrink-0" />
              <div>
                <p className="text-lg font-semibold tracking-[-0.01em] text-navy-900">{firm.name}</p>
                <p className="max-w-xs text-xs leading-relaxed text-ink-2">{firm.address}</p>
                <p className="mt-1 text-xs text-ink-2">{[firm.phone && `Ph ${firm.phone}`, firm.email].filter(Boolean).join(" · ")}</p>
                {firm.gstin && <p className="tnum mt-0.5 text-xs font-medium text-ink">GSTIN {firm.gstin}</p>}
              </div>
            </div>
            <div className="sm:text-right">
              <p className="text-xl font-semibold tracking-[0.08em] text-navy-900">TAX INVOICE</p>
              <dl className="mt-2 grid grid-cols-[auto_auto] justify-start gap-x-4 gap-y-0.5 text-xs sm:justify-end">
                <dt className="text-ink-3">Invoice No.</dt>
                <dd className="tnum font-semibold text-ink">{isDraft ? "—" : inv.number}</dd>
                <dt className="text-ink-3">Invoice Date</dt>
                <dd className="tnum text-ink">{formatDate(inv.invoiceDate)}</dd>
                <dt className="text-ink-3">Due Date</dt>
                <dd className="tnum text-ink">{formatDate(inv.dueDate)}</dd>
                {period !== "—" && (
                  <>
                    <dt className="text-ink-3">Billing Period</dt>
                    <dd className="text-ink">{period}</dd>
                  </>
                )}
              </dl>
            </div>
          </header>

          <section className="grid gap-6 py-6 sm:grid-cols-2">
            <div>
              <p className="mb-1.5 text-[10.5px] font-semibold tracking-[0.12em] text-ink-3 uppercase">Bill To</p>
              <p className="font-semibold text-ink">{client.name}</p>
              {client.tradeName && client.tradeName !== client.name && <p className="text-sm text-ink-2">{client.tradeName}</p>}
              <p className="text-sm text-ink-2">{[client.address, client.city, client.state].filter(Boolean).join(", ")}</p>
              <p className="tnum mt-1 text-xs text-ink-2">{[client.gstin && `GSTIN ${client.gstin}`, client.pan && `PAN ${client.pan}`].filter(Boolean).join(" · ")}</p>
            </div>
            <div className="sm:text-right">
              <p className="mb-1.5 text-[10.5px] font-semibold tracking-[0.12em] text-ink-3 uppercase">Place of Supply</p>
              <p className="text-sm text-ink">{client.state ?? firm.state ?? "—"}</p>
              <p className="mt-3 text-[10.5px] font-semibold tracking-[0.12em] text-ink-3 uppercase">Amount Due</p>
              <p className="tnum text-2xl font-semibold text-navy-900">{formatINR(isDraft ? inv.total : outstanding)}</p>
            </div>
          </section>

          <table className="w-full text-sm">
            <thead>
              <tr className="border-y border-line bg-subtle text-[10.5px] tracking-[0.1em] text-ink-3 uppercase">
                <th className="py-2 ps-3 text-left font-semibold">#</th>
                <th className="py-2 text-left font-semibold">Service</th>
                <th className="hidden py-2 text-left font-semibold sm:table-cell">SAC</th>
                <th className="py-2 pe-3 text-right font-semibold">Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={it.id} className="border-b border-line">
                  <td className="tnum py-3 ps-3 align-top text-ink-3">{i + 1}</td>
                  <td className="py-3 pe-3 align-top">
                    <p className="font-medium text-ink">{it.service}</p>
                    {it.description && <p className="text-xs text-ink-3">{it.description}</p>}
                  </td>
                  <td className="tnum hidden py-3 align-top text-ink-3 sm:table-cell">{settings.sac}</td>
                  <td className="tnum py-3 pe-3 text-right align-top">{formatINR(it.amount, { decimals: true }).replace("₹", "")}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-4 flex flex-col-reverse justify-between gap-6 sm:flex-row">
            <div className="max-w-sm text-xs text-ink-2">
              <p className="text-[10.5px] font-semibold tracking-[0.12em] text-ink-3 uppercase">Amount in words</p>
              <p className="mt-1 font-medium text-ink">{amountInWords(inv.total)}</p>
              {bank && (
                <div className="mt-4 rounded-lg border border-line p-3">
                  <p className="text-[10.5px] font-semibold tracking-[0.12em] text-ink-3 uppercase">Payment details</p>
                  <p className="mt-1">{bank.accountName} · {bank.bankName}</p>
                  <p className="tnum">A/c {bank.accountNumber} · IFSC {bank.ifsc}</p>
                  {bank.upiId && <p className="tnum">UPI {bank.upiId}</p>}
                </div>
              )}
            </div>
            <dl className="w-full space-y-1.5 text-sm sm:w-72">
              <Line label="Sub-total" value={inv.subtotal} />
              {inv.discount > 0 && <Line label="Discount" value={-inv.discount} />}
              <Line label="Taxable value" value={taxable} />
              {intraState ? (
                <>
                  <Line label={`CGST @ ${inv.gstRate / 2}%`} value={half} />
                  <Line label={`SGST @ ${inv.gstRate / 2}%`} value={inv.gstAmount - half} />
                </>
              ) : (
                <Line label={`IGST @ ${inv.gstRate}%`} value={inv.gstAmount} />
              )}
              <Line label="Round off" value={inv.total - taxable - inv.gstAmount} />
              <div className="flex justify-between border-t-2 border-navy-900 pt-2 text-base font-semibold">
                <dt>Total</dt>
                <dd className="tnum">{formatINR(inv.total, { decimals: true })}</dd>
              </div>
              {paid > 0 && (
                <>
                  <Line label="Received" value={-paid} />
                  <div className="flex justify-between font-semibold">
                    <dt>Balance</dt>
                    <dd className="tnum">{formatINR(outstanding, { decimals: true })}</dd>
                  </div>
                </>
              )}
            </dl>
          </div>

          {(inv.notes || settings.terms) && (
            <div className="mt-8 border-t border-line pt-4 text-xs text-ink-2">
              {inv.notes && <p className="mb-2">{inv.notes}</p>}
              <p className="text-ink-3">{settings.terms}</p>
            </div>
          )}
          <footer className="mt-10 flex items-end justify-between text-xs">
            <p className="text-ink-3">This is a computer-generated invoice.</p>
            <div className="text-right">
              <p className="font-medium text-ink">For {firm.name}</p>
              <div className="h-10" />
              <p className="border-t border-line pt-1 text-ink-3">Authorised Signatory</p>
            </div>
          </footer>
        </article>

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

function Line({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between text-ink-2">
      <dt>{label}</dt>
      <dd className="tnum">{formatINR(value, { decimals: true })}</dd>
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
