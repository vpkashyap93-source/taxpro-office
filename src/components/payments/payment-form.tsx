"use client";

import { useState } from "react";
import { PAYMENT_MODES } from "@/db/schema";
import { formatINR, parseRupeesToPaise } from "@/lib/money";
import { recordPayment } from "@/server/actions/billing";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { DatePicker, Field, FormError, FormGrid, Input, MoneyInput, Select, SubmitButton, Textarea } from "@/components/ui/form";
import { useFormAction } from "@/components/ui/use-form-action";
import { useUrlState } from "@/components/ui/use-url-state";

export interface OpenInvoice {
  id: string;
  clientId: string;
  number: string;
  total: number;
  paid: number;
  outstanding: number;
  dueDate: string;
}

export function PaymentFormModal({ clients, invoices, today, onClose, initialClient, initialInvoice }: { clients: { value: string; label: string }[]; invoices: OpenInvoice[]; today: string; onClose: () => void; initialClient?: string; initialInvoice?: string }) {
  const [clientId, setClientId] = useState(initialClient ?? "");
  const [invoiceId, setInvoiceId] = useState(initialInvoice ?? "");
  const inv = invoices.find((i) => i.id === invoiceId);
  const [amount, setAmount] = useState(inv ? String(inv.outstanding / 100) : "");
  const { formAction, err, formError } = useFormAction(recordPayment, { onSuccess: onClose });
  const open = invoices.filter((i) => i.clientId === clientId);
  const entered = parseRupeesToPaise(amount);
  const after = inv && Number.isFinite(entered) ? inv.outstanding - entered : null;

  return (
    <Modal
      open
      onClose={onClose}
      title="Record Payment"
      description="Partial payments are supported — the balance stays outstanding on the invoice."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <SubmitButton form="payment-form" variant="success">Record payment</SubmitButton>
        </>
      }
    >
      <form id="payment-form" action={formAction} noValidate>
        <FormError message={formError} />
        <FormGrid>
          <Field label="Client" htmlFor="pay-client" required error={err("clientId")} className="sm:col-span-2">
            <Select
              id="pay-client"
              name="clientId"
              value={clientId}
              onChange={(e) => {
                setClientId(e.target.value);
                setInvoiceId("");
                setAmount("");
              }}
              options={clients}
              placeholder="Select a client…"
              invalid={!!err("clientId")}
            />
          </Field>
          <Field label="Invoice" htmlFor="pay-invoice" error={err("invoiceId")} className="sm:col-span-2" hint={clientId && !open.length ? "No unpaid invoices — the payment will be recorded on account." : undefined}>
            <Select
              id="pay-invoice"
              name="invoiceId"
              value={invoiceId}
              disabled={!clientId}
              onChange={(e) => {
                setInvoiceId(e.target.value);
                const i = invoices.find((x) => x.id === e.target.value);
                setAmount(i ? String(i.outstanding / 100) : "");
              }}
              options={open.map((i) => ({ value: i.id, label: `${i.number} · ${formatINR(i.outstanding)} due` }))}
              placeholder="On account (no invoice)"
            />
          </Field>
        </FormGrid>
        {inv && (
          <dl className="my-4 grid grid-cols-3 gap-2 rounded-xl border border-line bg-subtle p-3 text-center text-sm">
            <div>
              <dt className="text-xs text-ink-3">Invoice Amount</dt>
              <dd className="tnum font-semibold">{formatINR(inv.total)}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-3">Paid Amount</dt>
              <dd className="tnum font-semibold text-brand">{formatINR(inv.paid)}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-3">Outstanding</dt>
              <dd className="tnum font-semibold text-danger">{formatINR(inv.outstanding)}</dd>
            </div>
          </dl>
        )}
        <FormGrid className="mt-4">
          <Field label="Amount" htmlFor="pay-amount" required error={err("amount")} hint={after !== null ? (after < 0 ? "Exceeds the outstanding amount" : after === 0 ? "Invoice will be fully paid" : `${formatINR(after)} will remain outstanding`) : undefined}>
            <MoneyInput id="pay-amount" name="amount" value={amount} onChange={(e) => setAmount(e.target.value)} invalid={!!err("amount") || (after !== null && after < 0)} />
          </Field>
          <Field label="Payment Date" htmlFor="pay-date" required error={err("paymentDate")}>
            <DatePicker id="pay-date" name="paymentDate" defaultValue={today} max={today} />
          </Field>
          <Field label="Payment Mode" htmlFor="pay-mode" required>
            <Select id="pay-mode" name="mode" defaultValue="UPI" options={PAYMENT_MODES} />
          </Field>
          <Field label="Reference Number" htmlFor="pay-ref" hint="UTR / cheque no. / UPI ref">
            <Input id="pay-ref" name="reference" />
          </Field>
          <Field label="Notes" htmlFor="pay-notes" className="sm:col-span-2">
            <Textarea id="pay-notes" name="notes" rows={2} />
          </Field>
        </FormGrid>
      </form>
    </Modal>
  );
}

export function PaymentModalController(props: { clients: { value: string; label: string }[]; invoices: OpenInvoice[]; today: string }) {
  const { params, patch } = useUrlState();
  if (params.get("new") !== "1") return null;
  return <PaymentFormModal {...props} initialClient={params.get("client") ?? undefined} initialInvoice={params.get("invoice") ?? undefined} onClose={() => patch({ new: null, client: null, invoice: null })} />;
}

export function RecordPaymentButton() {
  const { patch } = useUrlState();
  return (
    <Button variant="success" onClick={() => patch({ new: "1" })}>
      Record Payment
    </Button>
  );
}
