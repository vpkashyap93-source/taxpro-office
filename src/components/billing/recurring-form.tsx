"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { BILLING_FREQUENCIES, BILLING_SERVICES } from "@/db/schema";
import type { ActionResult } from "@/lib/action-types";
import { formatINR, parseRupeesToPaise } from "@/lib/money";
import { saveRecurring } from "@/server/actions/billing";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, FormError, FormGrid, Input, MoneyInput, Select, SubmitButton, Textarea } from "@/components/ui/form";
import { useFormAction } from "@/components/ui/use-form-action";

type Service = (typeof BILLING_SERVICES)[number];

export interface RecurringInitial {
  id?: string;
  clientId?: string;
  active: boolean;
  frequency: string;
  intervalMonths: number;
  nextPeriodStart: string;
  dueDays: number;
  gstRate: number;
  notes?: string | null;
  items: { service: Service; description?: string | null; amount: number }[];
}

export function RecurringFormModal({ initial, clients, onClose }: { initial: RecurringInitial; clients: { value: string; label: string }[]; onClose: () => void }) {
  const editing = !!initial.id;
  const [frequency, setFrequency] = useState(initial.frequency);
  const [lines, setLines] = useState(
    initial.items.length ? initial.items.map((i, k) => ({ key: k, service: i.service, description: i.description ?? "", amount: String(i.amount / 100) })) : [{ key: 0, service: "Accounting" as Service, description: "", amount: "" }],
  );
  const action = saveRecurring.bind(null, initial.id ?? null) as (s: ActionResult, fd: FormData) => Promise<ActionResult>;
  const { formAction, err, formError } = useFormAction(action, { onSuccess: onClose });
  const total = lines.reduce((a, l) => a + (Number.isFinite(parseRupeesToPaise(l.amount)) ? parseRupeesToPaise(l.amount) : 0), 0);
  const itemsJson = useMemo(() => JSON.stringify(lines.filter((l) => l.amount.trim()).map((l) => ({ service: l.service, description: l.description, amount: l.amount }))), [lines]);

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={editing ? "Edit recurring billing" : "Set up recurring billing"}
      description="Bills are generated only when you click “Generate Monthly Bills” and are never sent automatically."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <SubmitButton form="recurring-form">{editing ? "Save plan" : "Create plan"}</SubmitButton>
        </>
      }
    >
      <form id="recurring-form" action={formAction} noValidate>
        <FormError message={formError} />
        <input type="hidden" name="items" value={itemsJson} />
        <FormGrid>
          <Field label="Client" htmlFor="rb-client" required error={err("clientId")} className="sm:col-span-2">
            {editing ? (
              <>
                <input type="hidden" name="clientId" value={initial.clientId} />
                <Input id="rb-client" value={clients.find((c) => c.value === initial.clientId)?.label ?? ""} disabled />
              </>
            ) : (
              <Select id="rb-client" name="clientId" defaultValue={initial.clientId ?? ""} options={clients} placeholder="Select a client…" invalid={!!err("clientId")} />
            )}
          </Field>
          <Field label="Billing frequency" htmlFor="rb-freq" required>
            <Select id="rb-freq" name="frequency" value={frequency} onChange={(e) => setFrequency(e.target.value)} options={BILLING_FREQUENCIES} />
          </Field>
          {frequency === "Custom" ? (
            <Field label="Every (months)" htmlFor="rb-int" error={err("intervalMonths")}>
              <Input id="rb-int" name="intervalMonths" type="number" min={1} max={24} defaultValue={initial.intervalMonths} />
            </Field>
          ) : (
            <Field label="Next period to bill" htmlFor="rb-next" required error={err("nextPeriodStart")} hint="First month not yet billed">
              <Input id="rb-next" name="nextPeriodStart" type="month" defaultValue={initial.nextPeriodStart.slice(0, 7)} />
            </Field>
          )}
          {frequency === "Custom" && (
            <Field label="Next period to bill" htmlFor="rb-next2" required error={err("nextPeriodStart")}>
              <Input id="rb-next2" name="nextPeriodStart" type="month" defaultValue={initial.nextPeriodStart.slice(0, 7)} />
            </Field>
          )}
          <Field label="Payment due (days after invoice)" htmlFor="rb-due" error={err("dueDays")}>
            <Input id="rb-due" name="dueDays" type="number" min={0} max={120} defaultValue={initial.dueDays} />
          </Field>
          <Field label="GST rate" htmlFor="rb-gst">
            <Select id="rb-gst" name="gstRate" defaultValue={String(initial.gstRate)} options={["0", "5", "12", "18", "28"].map((r) => ({ value: r, label: `${r}%` }))} />
          </Field>
        </FormGrid>

        <div className="mt-6">
          <p className="mb-2 text-[13px] font-medium text-ink-2">Fee lines (per period, before GST)</p>
          {err("items") && <p className="mb-2 text-sm text-danger">{err("items")}</p>}
          <div className="space-y-2">
            {lines.map((l, idx) => (
              <div key={l.key} className="grid grid-cols-12 gap-2">
                <div className="col-span-12 sm:col-span-4">
                  <Select aria-label={`Service ${idx + 1}`} value={l.service} onChange={(e) => setLines((ls) => ls.map((x) => (x.key === l.key ? { ...x, service: e.target.value as Service } : x)))} options={BILLING_SERVICES} />
                </div>
                <div className="col-span-12 sm:col-span-4">
                  <Input aria-label={`Description ${idx + 1}`} placeholder="Description (optional)" value={l.description} onChange={(e) => setLines((ls) => ls.map((x) => (x.key === l.key ? { ...x, description: e.target.value } : x)))} />
                </div>
                <div className="col-span-9 sm:col-span-3">
                  <MoneyInput aria-label={`Amount ${idx + 1}`} value={l.amount} placeholder="0" onChange={(e) => setLines((ls) => ls.map((x) => (x.key === l.key ? { ...x, amount: e.target.value } : x)))} className="text-right" />
                </div>
                <div className="col-span-3 flex justify-end sm:col-span-1">
                  <Button variant="ghost" size="icon" aria-label={`Remove line ${idx + 1}`} disabled={lines.length === 1} onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between">
            <Button size="sm" variant="secondary" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setLines((ls) => [...ls, { key: Date.now(), service: "Other", description: "", amount: "" }])}>
              Add line
            </Button>
            <p className="text-sm text-ink-3">
              Total per period <strong className="tnum text-base text-ink">{formatINR(total)}</strong>
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-4">
          <Checkbox name="active" defaultChecked={initial.active} label="Recurring Billing: ON" />
          <Textarea name="notes" defaultValue={initial.notes ?? ""} placeholder="Internal notes (optional)" rows={2} aria-label="Notes" />
        </div>
      </form>
    </Modal>
  );
}
