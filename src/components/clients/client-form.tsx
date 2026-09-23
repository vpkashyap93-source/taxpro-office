"use client";

import { useRouter } from "next/navigation";
import { SERVICES, CLIENT_STATUSES } from "@/db/schema";
import { BUSINESS_TYPES, CONSTITUTIONS, INDIAN_STATES } from "@/lib/identifiers";
import type { ActionResult } from "@/lib/action-types";
import { createClient, updateClient } from "@/server/actions/clients";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Field, FormError, FormGrid, FormSection, Input, Select, SubmitButton, Textarea } from "@/components/ui/form";
import { useFormAction } from "@/components/ui/use-form-action";
import type { Option } from "@/server/queries/common";

export interface ClientFormValues {
  id?: string;
  name?: string;
  tradeName?: string | null;
  mobile?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  pan?: string | null;
  gstin?: string | null;
  tan?: string | null;
  udyam?: string | null;
  businessType?: string | null;
  constitution?: string | null;
  financialYear?: string | null;
  status?: string;
  managerId?: string | null;
  notes?: string | null;
  services?: string[];
}

export function ClientFormModal({ open, onClose, initial, staff, defaultFy }: { open: boolean; onClose: () => void; initial?: ClientFormValues; staff: Option[]; defaultFy: string }) {
  const router = useRouter();
  const editing = !!initial?.id;
  const action = editing ? updateClient.bind(null, initial!.id!) : createClient;
  const { formAction, err, formError } = useFormAction<{ id: string }>(action as (s: ActionResult<{ id: string }>, fd: FormData) => Promise<ActionResult<{ id: string }>>, {
    onSuccess: (data) => {
      onClose();
      if (!editing && data?.id) router.push(`/clients/${data.id}`);
    },
  });
  const v = initial ?? {};
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={editing ? `Edit ${v.name}` : "Add Client"}
      description="PAN, GSTIN and TAN are format-checked. GSTIN must match the PAN."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <SubmitButton form="client-form">{editing ? "Save changes" : "Add client"}</SubmitButton>
        </>
      }
    >
      <form id="client-form" action={formAction} noValidate>
        <FormError message={formError} />
        <FormSection title="Identity">
          <FormGrid>
            <Field label="Client Name" htmlFor="name" required error={err("name")}>
              <Input id="name" name="name" defaultValue={v.name ?? ""} invalid={!!err("name")} autoFocus />
            </Field>
            <Field label="Trade Name" htmlFor="tradeName" error={err("tradeName")}>
              <Input id="tradeName" name="tradeName" defaultValue={v.tradeName ?? ""} />
            </Field>
            <Field label="Constitution" htmlFor="constitution">
              <Select id="constitution" name="constitution" defaultValue={v.constitution ?? ""} options={CONSTITUTIONS} placeholder="Select…" />
            </Field>
            <Field label="Business Type" htmlFor="businessType">
              <Select id="businessType" name="businessType" defaultValue={v.businessType ?? ""} options={BUSINESS_TYPES} placeholder="Select…" />
            </Field>
            <Field label="Status" htmlFor="status" required>
              <Select id="status" name="status" defaultValue={v.status ?? "Active"} options={CLIENT_STATUSES} />
            </Field>
            <Field label="Financial Year" htmlFor="financialYear" error={err("financialYear")} hint="e.g. 2026-27">
              <Input id="financialYear" name="financialYear" defaultValue={v.financialYear ?? defaultFy} invalid={!!err("financialYear")} />
            </Field>
          </FormGrid>
        </FormSection>
        <FormSection title="Tax identifiers">
          <FormGrid>
            <Field label="PAN" htmlFor="pan" error={err("pan")}>
              <Input id="pan" name="pan" defaultValue={v.pan ?? ""} className="uppercase tnum" maxLength={10} invalid={!!err("pan")} placeholder="ABCDE1234F" />
            </Field>
            <Field label="GSTIN" htmlFor="gstin" error={err("gstin")}>
              <Input id="gstin" name="gstin" defaultValue={v.gstin ?? ""} className="uppercase tnum" maxLength={15} invalid={!!err("gstin")} placeholder="03ABCDE1234F1Z5" />
            </Field>
            <Field label="TAN" htmlFor="tan" error={err("tan")}>
              <Input id="tan" name="tan" defaultValue={v.tan ?? ""} className="uppercase tnum" maxLength={10} invalid={!!err("tan")} />
            </Field>
            <Field label="UDYAM" htmlFor="udyam" error={err("udyam")}>
              <Input id="udyam" name="udyam" defaultValue={v.udyam ?? ""} className="uppercase" invalid={!!err("udyam")} placeholder="UDYAM-PB-07-0012345" />
            </Field>
          </FormGrid>
        </FormSection>
        <FormSection title="Contact">
          <FormGrid>
            <Field label="Mobile" htmlFor="mobile" error={err("mobile")}>
              <Input id="mobile" name="mobile" inputMode="numeric" defaultValue={v.mobile ?? ""} maxLength={10} invalid={!!err("mobile")} />
            </Field>
            <Field label="Email" htmlFor="email" error={err("email")}>
              <Input id="email" name="email" type="email" defaultValue={v.email ?? ""} invalid={!!err("email")} />
            </Field>
            <Field label="Address" htmlFor="address" className="sm:col-span-2">
              <Input id="address" name="address" defaultValue={v.address ?? ""} />
            </Field>
            <Field label="City" htmlFor="city">
              <Input id="city" name="city" defaultValue={v.city ?? ""} />
            </Field>
            <Field label="State" htmlFor="state">
              <Select id="state" name="state" defaultValue={v.state ?? "Punjab"} options={INDIAN_STATES} placeholder="Select…" />
            </Field>
          </FormGrid>
        </FormSection>
        <FormSection title="Services & ownership">
          <div className="mb-4 flex flex-wrap gap-2">
            {SERVICES.map((svc) => (
              <label key={svc} className="cursor-pointer">
                <input type="checkbox" name="services" value={svc} defaultChecked={v.services?.includes(svc)} className="peer sr-only" />
                <span className="inline-flex h-8 items-center rounded-full border border-line-strong px-3 text-[13px] font-medium text-ink-2 transition peer-checked:border-navy-900 peer-checked:bg-navy-900 peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-navy-600">
                  {svc}
                </span>
              </label>
            ))}
          </div>
          <FormGrid>
            <Field label="Relationship Manager" htmlFor="managerId">
              <Select id="managerId" name="managerId" defaultValue={v.managerId ?? ""} options={staff} placeholder="Unassigned" />
            </Field>
          </FormGrid>
          <Field label="Notes" htmlFor="notes" className="mt-4">
            <Textarea id="notes" name="notes" defaultValue={v.notes ?? ""} rows={3} />
          </Field>
        </FormSection>
      </form>
    </Modal>
  );
}
