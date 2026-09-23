"use client";

import { Plus } from "lucide-react";
import { DEPARTMENTS, DSC_RENEWAL_STATUSES, NOTICE_STATUSES } from "@/db/schema";
import type { ActionResult } from "@/lib/action-types";
import { deleteDsc, deleteNotice, saveDsc, saveNotice } from "@/server/actions/records";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { ActionForm, DatePicker, Field, FormError, FormGrid, Input, Select, SubmitButton, Textarea } from "@/components/ui/form";
import { useFormAction } from "@/components/ui/use-form-action";
import { useUrlState } from "@/components/ui/use-url-state";
import { ConfirmDelete } from "@/components/ui/confirm-delete";

type Opt = { value: string; label: string };
type Rec = Record<string, string | null | undefined>;

function NoticeModal({ initial, clients, staff, today, onClose }: { initial: Rec; clients: Opt[]; staff: Opt[]; today: string; onClose: () => void }) {
  const id = initial.id ?? null;
  const action = saveNotice.bind(null, id) as (s: ActionResult, fd: FormData) => Promise<ActionResult>;
  const { formAction, err, formError, pending } = useFormAction(action, { onSuccess: onClose });
  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={id ? "Edit notice" : "Add notice"}
      footer={
        <>
          {id && <ConfirmDelete title="Delete this notice?" onConfirm={() => deleteNotice(id)} onDone={onClose} />}
          <span className="flex-1" />
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <SubmitButton pending={pending} form="notice-form">{id ? "Save" : "Add notice"}</SubmitButton>
        </>
      }
    >
      <ActionForm id="notice-form" action={formAction} noValidate>
        <FormError message={formError} />
        <FormGrid>
          <Field label="Client" htmlFor="nt-client" required error={err("clientId")} className="sm:col-span-2">
            <Select id="nt-client" name="clientId" defaultValue={initial.clientId ?? ""} options={clients} placeholder="Select a client…" invalid={!!err("clientId")} />
          </Field>
          <Field label="Department" htmlFor="nt-dept">
            <Select id="nt-dept" name="department" defaultValue={initial.department ?? "GST"} options={DEPARTMENTS} />
          </Field>
          <Field label="Notice Type" htmlFor="nt-type" required error={err("noticeType")}>
            <Input id="nt-type" name="noticeType" defaultValue={initial.noticeType ?? ""} placeholder="e.g. Scrutiny (ASMT-10)" invalid={!!err("noticeType")} />
          </Field>
          <Field label="Section" htmlFor="nt-sec">
            <Input id="nt-sec" name="section" defaultValue={initial.section ?? ""} placeholder="e.g. Section 61" />
          </Field>
          <Field label="DIN / Reference" htmlFor="nt-ref">
            <Input id="nt-ref" name="reference" defaultValue={initial.reference ?? ""} className="tnum" />
          </Field>
          <Field label="Notice Date" htmlFor="nt-date" required error={err("noticeDate")}>
            <DatePicker id="nt-date" name="noticeDate" defaultValue={initial.noticeDate ?? today} />
          </Field>
          <Field label="Reply Due Date" htmlFor="nt-due">
            <DatePicker id="nt-due" name="dueDate" defaultValue={initial.dueDate ?? ""} />
          </Field>
          <Field label="Assigned To" htmlFor="nt-assignee">
            <Select id="nt-assignee" name="assignedTo" defaultValue={initial.assignedTo ?? ""} options={staff} placeholder="Unassigned" />
          </Field>
          <Field label="Status" htmlFor="nt-status">
            <Select id="nt-status" name="status" defaultValue={initial.status ?? "New"} options={NOTICE_STATUSES} />
          </Field>
          <Field label="Response Date" htmlFor="nt-resp">
            <DatePicker id="nt-resp" name="responseDate" defaultValue={initial.responseDate ?? ""} />
          </Field>
          <Field label="Notes" htmlFor="nt-notes" className="sm:col-span-2">
            <Textarea id="nt-notes" name="notes" defaultValue={initial.notes ?? ""} rows={3} />
          </Field>
        </FormGrid>
      </ActionForm>
    </Modal>
  );
}

function DscModal({ initial, clients, today, onClose }: { initial: Rec; clients: Opt[]; today: string; onClose: () => void }) {
  const id = initial.id ?? null;
  const action = saveDsc.bind(null, id) as (s: ActionResult, fd: FormData) => Promise<ActionResult>;
  const { formAction, err, formError, pending } = useFormAction(action, { onSuccess: onClose });
  return (
    <Modal
      open
      onClose={onClose}
      title={id ? "Edit DSC" : "Add DSC"}
      footer={
        <>
          {id && <ConfirmDelete title="Delete this DSC record?" onConfirm={() => deleteDsc(id)} onDone={onClose} />}
          <span className="flex-1" />
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <SubmitButton pending={pending} form="dsc-form">{id ? "Save" : "Add DSC"}</SubmitButton>
        </>
      }
    >
      <ActionForm id="dsc-form" action={formAction} noValidate>
        <FormError message={formError} />
        <FormGrid>
          <Field label="Client" htmlFor="ds-client" required error={err("clientId")} className="sm:col-span-2">
            <Select id="ds-client" name="clientId" defaultValue={initial.clientId ?? ""} options={clients} placeholder="Select a client…" invalid={!!err("clientId")} />
          </Field>
          <Field label="DSC Holder" htmlFor="ds-holder" required error={err("holderName")}>
            <Input id="ds-holder" name="holderName" defaultValue={initial.holderName ?? ""} invalid={!!err("holderName")} />
          </Field>
          <Field label="Class" htmlFor="ds-class">
            <Select id="ds-class" name="dscClass" defaultValue={initial.dscClass ?? "Class 3"} options={["Class 3", "Class 3 (Signing + Encryption)", "DGFT", "Other"]} />
          </Field>
          <Field label="Issue Date" htmlFor="ds-issue" required error={err("issueDate")}>
            <DatePicker id="ds-issue" name="issueDate" defaultValue={initial.issueDate ?? today} />
          </Field>
          <Field label="Expiry Date" htmlFor="ds-exp" required error={err("expiryDate")}>
            <DatePicker id="ds-exp" name="expiryDate" defaultValue={initial.expiryDate ?? ""} invalid={!!err("expiryDate")} />
          </Field>
          <Field label="Renewal Status" htmlFor="ds-status">
            <Select id="ds-status" name="renewalStatus" defaultValue={initial.renewalStatus ?? "Active"} options={DSC_RENEWAL_STATUSES} />
          </Field>
          <Field label="Custody" htmlFor="ds-custody">
            <Select id="ds-custody" name="custody" defaultValue={initial.custody ?? "With office"} options={["With office", "With client"]} />
          </Field>
          <Field label="Notes" htmlFor="ds-notes" className="sm:col-span-2">
            <Textarea id="ds-notes" name="notes" defaultValue={initial.notes ?? ""} rows={2} />
          </Field>
        </FormGrid>
      </ActionForm>
    </Modal>
  );
}

export function RecordModals({ kind, clients, staff, today, editing, canEdit }: { kind: "notice" | "dsc"; clients: Opt[]; staff: Opt[]; today: string; editing: Rec | null; canEdit: boolean }) {
  const { params, patch } = useUrlState();
  if (!canEdit) return null;
  const M = kind === "notice" ? NoticeModal : DscModal;
  return (
    <>
      {params.get("new") === "1" && <M clients={clients} staff={staff} today={today} initial={{ clientId: params.get("client") }} onClose={() => patch({ new: null, client: null })} />}
      {editing && <M key={editing.id} clients={clients} staff={staff} today={today} initial={editing} onClose={() => patch({ edit: null })} />}
    </>
  );
}

export function AddRecordButton({ label }: { label: string }) {
  const { patch } = useUrlState();
  return (
    <Button icon={<Plus className="h-4 w-4" />} onClick={() => patch({ new: "1" })}>
      {label}
    </Button>
  );
}
