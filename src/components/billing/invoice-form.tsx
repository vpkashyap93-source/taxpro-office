"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2, Wand2 } from "lucide-react";
import { BILLING_SERVICES } from "@/db/schema";
import type { ActionResult } from "@/lib/action-types";
import { addDays, monthLabel } from "@/lib/dates";
import { computeInvoiceTotals, formatINR, parseRupeesToPaise } from "@/lib/money";
import { saveInvoice } from "@/server/actions/billing";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DatePicker, Field, FormError, Input, MoneyInput, Select, SubmitButton, Textarea } from "@/components/ui/form";
import { useFormAction } from "@/components/ui/use-form-action";

type Service = (typeof BILLING_SERVICES)[number];
interface Line {
  key: number;
  service: Service;
  description: string;
  amount: string; // rupees as typed
}

export interface InvoiceFormInitial {
  id?: string;
  number?: string;
  status?: string;
  clientId?: string;
  invoiceDate: string;
  dueDate?: string;
  billingPeriod?: string | null;
  gstRate: number;
  discount?: number; // paise
  notes?: string | null;
  items?: { service: Service; description: string | null; amount: number }[];
}

export function InvoiceForm({
  initial,
  clients,
  plans,
  defaultDueDays,
  months,
}: {
  initial: InvoiceFormInitial;
  clients: { value: string; label: string }[];
  plans: Record<string, { service: Service; description: string | null; amount: number }[]>;
  defaultDueDays: number;
  months: string[];
}) {
  const editing = !!initial.id;
  const isDraft = !editing || initial.status === "Draft";
  const [clientId, setClientId] = useState(initial.clientId ?? "");
  const [invoiceDate, setInvoiceDate] = useState(initial.invoiceDate);
  const [dueDate, setDueDate] = useState(initial.dueDate ?? addDays(initial.invoiceDate, defaultDueDays));
  const [dueTouched, setDueTouched] = useState(editing);
  const [gstRate, setGstRate] = useState(String(initial.gstRate));
  const [discount, setDiscount] = useState(initial.discount ? String(initial.discount / 100) : "");
  const [lines, setLines] = useState<Line[]>(
    initial.items?.length
      ? initial.items.map((it, i) => ({ key: i, service: it.service, description: it.description ?? "", amount: String(it.amount / 100) }))
      : [{ key: 0, service: "GST Compliance", description: "", amount: "" }],
  );
  const [period, setPeriod] = useState(initial.billingPeriod ?? "");

  const action = saveInvoice.bind(null, initial.id ?? null) as (s: ActionResult<{ id: string }>, fd: FormData) => Promise<ActionResult<{ id: string }>>;
  const { formAction, err, formError } = useFormAction<{ id: string }>(action);

  const amounts = lines.map((l) => parseRupeesToPaise(l.amount)).map((n) => (Number.isFinite(n) ? n : 0));
  const disc = parseRupeesToPaise(discount);
  const totals = computeInvoiceTotals(amounts, Number.isFinite(disc) ? disc : 0, Number(gstRate));
  const itemsJson = useMemo(
    () => JSON.stringify(lines.filter((l) => l.amount.trim() !== "").map((l) => ({ service: l.service, description: l.description, amount: l.amount }))),
    [lines],
  );
  const plan = clientId ? plans[clientId] : undefined;

  const update = (key: number, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  return (
    <form action={formAction} noValidate className="grid gap-6 xl:grid-cols-3">
      <input type="hidden" name="items" value={itemsJson} />
      <div className="space-y-6 xl:col-span-2">
        <FormError message={formError} />
        <Card>
          <CardHeader title="Invoice details" />
          <CardBody className="grid gap-4 sm:grid-cols-2">
            <Field label="Client" htmlFor="clientId" required error={err("clientId")} className="sm:col-span-2">
              <Select id="clientId" name="clientId" value={clientId} onChange={(e) => setClientId(e.target.value)} options={clients} placeholder="Select a client…" invalid={!!err("clientId")} />
            </Field>
            <Field label="Invoice Number" hint={isDraft ? "Assigned automatically when the invoice is generated (sequential per financial year)." : undefined}>
              <Input value={initial.number && !initial.number.startsWith("DRAFT") ? initial.number : "Auto"} disabled className="tnum" />
            </Field>
            <Field label="Billing Period" htmlFor="billingPeriod" hint="Month of service">
              <Select id="billingPeriod" name="billingPeriod" value={period} onChange={(e) => setPeriod(e.target.value)} options={months.map((m) => ({ value: m, label: monthLabel(m, "long") }))} placeholder="Not period-specific" />
            </Field>
            <Field label="Invoice Date" htmlFor="invoiceDate" required error={err("invoiceDate")}>
              <DatePicker
                id="invoiceDate"
                name="invoiceDate"
                value={invoiceDate}
                onChange={(e) => {
                  setInvoiceDate(e.target.value);
                  if (!dueTouched && e.target.value) setDueDate(addDays(e.target.value, defaultDueDays));
                }}
              />
            </Field>
            <Field label="Due Date" htmlFor="dueDate" required error={err("dueDate")}>
              <DatePicker
                id="dueDate"
                name="dueDate"
                value={dueDate}
                invalid={!!err("dueDate")}
                onChange={(e) => {
                  setDueDate(e.target.value);
                  setDueTouched(true);
                }}
              />
            </Field>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Services"
            subtitle="Professional fees, before GST"
            action={
              plan?.length ? (
                <Button
                  size="sm"
                  variant="gold"
                  icon={<Wand2 className="h-3.5 w-3.5" />}
                  onClick={() => setLines(plan.map((p, i) => ({ key: Date.now() + i, service: p.service, description: p.description ?? "", amount: String(p.amount / 100) })))}
                >
                  Use monthly fees
                </Button>
              ) : undefined
            }
          />
          <CardBody className="space-y-3">
            {err("items") && <p className="text-sm text-danger">{err("items")}</p>}
            {lines.map((l, idx) => (
              <div key={l.key} className="grid grid-cols-12 gap-2 rounded-xl border border-line bg-subtle p-3 sm:border-0 sm:bg-transparent sm:p-0">
                <div className="col-span-12 sm:col-span-4">
                  <label className="sr-only" htmlFor={`svc-${l.key}`}>Service {idx + 1}</label>
                  <Select id={`svc-${l.key}`} value={l.service} onChange={(e) => update(l.key, { service: e.target.value as Service })} options={BILLING_SERVICES} />
                </div>
                <div className="col-span-12 sm:col-span-5">
                  <label className="sr-only" htmlFor={`desc-${l.key}`}>Description {idx + 1}</label>
                  <Input id={`desc-${l.key}`} placeholder="Description (optional)" value={l.description} onChange={(e) => update(l.key, { description: e.target.value })} />
                </div>
                <div className="col-span-9 sm:col-span-2">
                  <label className="sr-only" htmlFor={`amt-${l.key}`}>Amount {idx + 1}</label>
                  <MoneyInput id={`amt-${l.key}`} placeholder="0" value={l.amount} onChange={(e) => update(l.key, { amount: e.target.value })} className="text-right" />
                </div>
                <div className="col-span-3 flex justify-end sm:col-span-1">
                  <Button variant="ghost" size="icon" aria-label={`Remove line ${idx + 1}`} disabled={lines.length === 1} onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            <Button variant="secondary" size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setLines((ls) => [...ls, { key: Date.now(), service: "Other", description: "", amount: "" }])}>
              Add line
            </Button>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Notes" subtitle="Printed on the invoice" />
          <CardBody>
            <Textarea name="notes" defaultValue={initial.notes ?? ""} rows={3} placeholder="e.g. Thank you for your business." />
          </CardBody>
        </Card>
      </div>

      <div className="xl:col-span-1">
        <Card className="xl:sticky xl:top-24">
          <CardHeader title="Summary" />
          <CardBody className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="GST" htmlFor="gstRate">
                <Select id="gstRate" name="gstRate" value={gstRate} onChange={(e) => setGstRate(e.target.value)} options={["0", "5", "12", "18", "28"].map((r) => ({ value: r, label: `${r}%` }))} />
              </Field>
              <Field label="Discount" htmlFor="discount" error={err("discount")}>
                <MoneyInput id="discount" name="discount" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="0" />
              </Field>
            </div>
            <dl className="space-y-2 border-t border-line pt-4 text-sm">
              <Row label="Amount" value={formatINR(totals.subtotal, { decimals: true })} />
              {totals.discount > 0 && <Row label="Discount" value={`− ${formatINR(totals.discount, { decimals: true })}`} />}
              <Row label={`GST @ ${gstRate}%`} value={formatINR(totals.gstAmount, { decimals: true })} />
              <div className="flex items-baseline justify-between border-t border-line pt-3">
                <dt className="font-semibold">Total</dt>
                <dd className="tnum text-2xl font-semibold tracking-[-0.02em]">{formatINR(totals.total)}</dd>
              </div>
              <p className="text-right text-xs text-ink-4">Rounded to the nearest rupee</p>
            </dl>
            <div className="flex flex-col gap-2 pt-2">
              {isDraft ? (
                <>
                  <SubmitButton variant="success" className="w-full" pendingLabel="Saving…" name="status" value="Generated">
                    Generate Invoice
                  </SubmitButton>
                  <button type="submit" name="status" value="Draft" formNoValidate className="h-9.5 w-full rounded-lg border border-line-strong bg-surface text-sm font-medium text-ink hover:bg-subtle">
                    Save as Draft
                  </button>
                </>
              ) : (
                <SubmitButton className="w-full" name="status" value="Generated">
                  Save changes
                </SubmitButton>
              )}
              <p className="text-center text-xs text-ink-3">Invoices are never sent automatically — you choose when to share.</p>
            </div>
          </CardBody>
        </Card>
      </div>
    </form>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-ink-3">{label}</dt>
      <dd className="tnum text-ink">{value}</dd>
    </div>
  );
}
