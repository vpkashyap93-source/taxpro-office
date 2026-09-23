"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Plus } from "lucide-react";
import { COMPLIANCE_CATEGORIES } from "@/db/schema";
import type { ActionResult } from "@/lib/action-types";
import { INDIAN_STATES } from "@/lib/identifiers";
import { changeMyPassword, saveBilling, saveComplianceType, saveFirm, toggleComplianceType } from "@/server/actions/admin";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { ActionForm, Field, FormError, FormGrid, Input, Select, SubmitButton, Textarea } from "@/components/ui/form";
import { useFormAction } from "@/components/ui/use-form-action";
import { useUrlState } from "@/components/ui/use-url-state";
import { useToast } from "@/components/ui/toast";

type Firm = { name: string; legalName: string | null; gstin: string | null; pan: string | null; email: string | null; phone: string | null; address: string | null; state: string | null };

export function FirmForm({ firm, disabled }: { firm: Firm; disabled: boolean }) {
  const { formAction, err, formError } = useFormAction(saveFirm);
  return (
    <ActionForm action={formAction} noValidate>
      <FormError message={formError} />
      <fieldset disabled={disabled}>
        <FormGrid>
          <Field label="Firm name" htmlFor="f-name" required error={err("name")}><Input id="f-name" name="name" defaultValue={firm.name} /></Field>
          <Field label="Legal name" htmlFor="f-legal"><Input id="f-legal" name="legalName" defaultValue={firm.legalName ?? ""} /></Field>
          <Field label="GSTIN" htmlFor="f-gstin" error={err("gstin")}><Input id="f-gstin" name="gstin" defaultValue={firm.gstin ?? ""} className="uppercase tnum" /></Field>
          <Field label="PAN" htmlFor="f-pan" error={err("pan")}><Input id="f-pan" name="pan" defaultValue={firm.pan ?? ""} className="uppercase tnum" /></Field>
          <Field label="Email" htmlFor="f-email" error={err("email")}><Input id="f-email" name="email" defaultValue={firm.email ?? ""} /></Field>
          <Field label="Phone" htmlFor="f-phone"><Input id="f-phone" name="phone" defaultValue={firm.phone ?? ""} /></Field>
          <Field label="Address" htmlFor="f-address" className="sm:col-span-2"><Input id="f-address" name="address" defaultValue={firm.address ?? ""} /></Field>
          <Field label="State" htmlFor="f-state" hint="Used to decide CGST+SGST vs IGST on invoices"><Select id="f-state" name="state" defaultValue={firm.state ?? ""} options={INDIAN_STATES} placeholder="Select…" /></Field>
        </FormGrid>
        {!disabled && <div className="mt-4 flex justify-end"><SubmitButton>Save firm profile</SubmitButton></div>}
      </fieldset>
    </ActionForm>
  );
}

type Billing = { prefix: string; defaultDueDays: number; defaultGstRate: number; sac: string; terms: string; accountName: string; bankName: string; accountNumber: string; ifsc: string; upiId: string };

export function BillingSettingsForm({ values, disabled }: { values: Billing; disabled: boolean }) {
  const { formAction, err, formError } = useFormAction(saveBilling);
  return (
    <ActionForm action={formAction} noValidate>
      <FormError message={formError} />
      <fieldset disabled={disabled}>
        <FormGrid cols={3}>
          <Field label="Invoice prefix" htmlFor="b-prefix" error={err("prefix")} hint="e.g. TPO → TPO/2026-27/0001"><Input id="b-prefix" name="prefix" defaultValue={values.prefix} className="uppercase" /></Field>
          <Field label="Default due (days)" htmlFor="b-due" error={err("defaultDueDays")}><Input id="b-due" name="defaultDueDays" type="number" defaultValue={values.defaultDueDays} /></Field>
          <Field label="Default GST %" htmlFor="b-gst"><Select id="b-gst" name="defaultGstRate" defaultValue={String(values.defaultGstRate)} options={["0", "5", "12", "18", "28"]} /></Field>
          <Field label="SAC code" htmlFor="b-sac" error={err("sac")}><Input id="b-sac" name="sac" defaultValue={values.sac} className="tnum" /></Field>
          <Field label="Terms" htmlFor="b-terms" className="sm:col-span-2"><Textarea id="b-terms" name="terms" defaultValue={values.terms} rows={2} /></Field>
        </FormGrid>
        <p className="mt-6 mb-3 text-xs font-semibold tracking-[0.08em] text-ink-3 uppercase">Bank & UPI (printed on invoices)</p>
        <FormGrid cols={3}>
          <Field label="Account name" htmlFor="b-an"><Input id="b-an" name="accountName" defaultValue={values.accountName} /></Field>
          <Field label="Bank" htmlFor="b-bank"><Input id="b-bank" name="bankName" defaultValue={values.bankName} /></Field>
          <Field label="Account number" htmlFor="b-acc" error={err("accountNumber")}><Input id="b-acc" name="accountNumber" defaultValue={values.accountNumber} className="tnum" /></Field>
          <Field label="IFSC" htmlFor="b-ifsc" error={err("ifsc")}><Input id="b-ifsc" name="ifsc" defaultValue={values.ifsc} className="uppercase tnum" /></Field>
          <Field label="UPI ID" htmlFor="b-upi" error={err("upiId")}><Input id="b-upi" name="upiId" defaultValue={values.upiId} /></Field>
        </FormGrid>
        {!disabled && <div className="mt-4 flex justify-end"><SubmitButton>Save billing settings</SubmitButton></div>}
      </fieldset>
    </ActionForm>
  );
}

export interface CType { id: string; category: string; name: string; periodicity: string; defaultDueDay: number | null; active: boolean }

function TypeModal({ initial, onClose }: { initial: Partial<CType>; onClose: () => void }) {
  const action = saveComplianceType.bind(null, initial.id ?? null) as (s: ActionResult, fd: FormData) => Promise<ActionResult>;
  const { formAction, err, formError, pending } = useFormAction(action, { onSuccess: onClose });
  return (
    <Modal open onClose={onClose} size="sm" title={initial.id ? "Edit compliance type" : "Add compliance type"} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><SubmitButton pending={pending} form="type-form">Save</SubmitButton></>}>
      <ActionForm id="type-form" action={formAction} noValidate>
        <FormError message={formError} />
        <FormGrid cols={1}>
          <Field label="Category" htmlFor="t-cat"><Select id="t-cat" name="category" defaultValue={initial.category ?? "GST"} options={COMPLIANCE_CATEGORIES} /></Field>
          <Field label="Name" htmlFor="t-name" error={err("name")}><Input id="t-name" name="name" defaultValue={initial.name ?? ""} /></Field>
          <Field label="Periodicity" htmlFor="t-per"><Select id="t-per" name="periodicity" defaultValue={initial.periodicity ?? "Monthly"} options={["Monthly", "Quarterly", "Yearly", "One-time"]} /></Field>
          <Field label="Default due day (of the following month)" htmlFor="t-day" error={err("defaultDueDay")} hint="Your own reference — verify against current notifications. Leave blank to always enter per task.">
            <Input id="t-day" name="defaultDueDay" type="number" min={1} max={31} defaultValue={initial.defaultDueDay ?? ""} />
          </Field>
        </FormGrid>
      </ActionForm>
    </Modal>
  );
}

export function TypeToggle({ id, active, disabled }: { id: string; active: boolean; disabled: boolean }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();
  return (
    <button type="button" disabled={disabled || pending} onClick={() => start(async () => { const r = await toggleComplianceType(id, !active); toast(r.ok ? (r.message ?? "") : r.error, r.ok ? "success" : "error"); router.refresh(); })} className="text-[13px] font-medium text-navy-600 hover:underline disabled:text-ink-4 disabled:no-underline">
      {active ? "Disable" : "Enable"}
    </button>
  );
}

export function TypeModals({ types }: { types: CType[] }) {
  const { params, patch } = useUrlState();
  const t = params.get("type");
  const cur = t && t !== "new" ? types.find((x) => x.id === t) : null;
  return <>{t === "new" && <TypeModal initial={{}} onClose={() => patch({ type: null })} />}{cur && <TypeModal key={cur.id} initial={cur} onClose={() => patch({ type: null })} />}</>;
}

export function AddTypeButton() {
  const { patch } = useUrlState();
  return <Button size="sm" variant="secondary" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => patch({ type: "new" })}>Add type</Button>;
}

export function PasswordForm() {
  const { formAction, err, formError } = useFormAction(changeMyPassword);
  return (
    <ActionForm action={formAction} noValidate className="max-w-md space-y-4">
      <FormError message={formError} />
      <Field label="Current password" htmlFor="p-cur" error={err("current")}><Input id="p-cur" name="current" type="password" autoComplete="current-password" /></Field>
      <Field label="New password" htmlFor="p-new" error={err("next")} hint="At least 10 characters with letters and numbers"><Input id="p-new" name="next" type="password" autoComplete="new-password" /></Field>
      <Field label="Confirm new password" htmlFor="p-conf" error={err("confirm")}><Input id="p-conf" name="confirm" type="password" autoComplete="new-password" /></Field>
      <SubmitButton>Change password</SubmitButton>
    </ActionForm>
  );
}
