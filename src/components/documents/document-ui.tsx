"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Download, Eye, FilePlus2, Mail, MessageCircle, Plus, StickyNote, Trash2, Upload, X } from "lucide-react";
import { COMPLIANCE_CATEGORIES, DOCUMENT_STATUSES } from "@/db/schema";
import type { ActionResult } from "@/lib/action-types";
import { formatBytes } from "@/lib/format";
import { formatDate } from "@/lib/dates";
import { mailtoLink, whatsappLink } from "@/lib/share";
import {
  addDocumentItem,
  createChecklist,
  deleteChecklist,
  deleteDocumentItem,
  logDocumentRequest,
  removeDocumentFile,
  setDocumentNote,
  setDocumentStatus,
  uploadDocument,
} from "@/server/actions/documents";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { ActionForm, Checkbox, DatePicker, Field, FormError, FormGrid, Input, Select, SubmitButton, Textarea } from "@/components/ui/form";
import { InlineStatus } from "@/components/ui/inline-status";
import { StatusBadge } from "@/components/ui/status-badge";
import { ConfirmDelete } from "@/components/ui/confirm-delete";
import { useFormAction } from "@/components/ui/use-form-action";
import { useToast } from "@/components/ui/toast";
import { useUrlState } from "@/components/ui/use-url-state";

export interface DocItem {
  id: string;
  name: string;
  status: string;
  fileName: string | null;
  sizeBytes: number | null;
  mimeType: string | null;
  receivedAt: string | null;
  notes: string | null;
  hasFile: boolean;
}

export interface Checklist {
  id: string;
  clientId: string;
  clientName: string;
  clientMobile: string | null;
  clientEmail: string | null;
  title: string;
  period: string | null;
  category: string;
  dueDate: string | null;
  requestedAt: string | null;
  pending: number;
  items: DocItem[];
}

export const DOC_TEMPLATES: Record<string, string[]> = {
  GST: ["Purchase Data", "Sales Data", "Bank Statement", "Expense Bills", "E-commerce Report", "Other Documents"],
  ITR: ["Form 26AS / AIS", "Bank Statements (all accounts)", "Investment Proofs (80C/80D)", "Capital Gains Statement", "Form 16", "Other Documents"],
  TDS: ["Salary Register", "Vendor Payment Details", "Challan Copies", "PAN of Deductees", "Other Documents"],
  CMA: ["Audited Financials (3 years)", "Provisional Financials", "Stock Statement", "Debtors & Creditors Ageing", "Sanction Letter", "Other Documents"],
  ROC: ["Board Resolutions", "Audited Financials", "Shareholding Details", "Director KYC", "Other Documents"],
  Audit: ["Trial Balance", "Ledgers", "Fixed Asset Register", "Bank Reconciliation", "Confirmations", "Other Documents"],
  Other: ["Other Documents"],
};

function pendingMessage(c: Checklist, firmName: string) {
  const pending = c.items.filter((i) => i.status === "Pending" || i.status === "Partial").map((i) => `• ${i.name}${i.status === "Partial" ? " (balance)" : ""}`);
  return `Dear ${c.clientName},\n\nFor ${c.title}, we are awaiting the following documents:\n${pending.join("\n")}\n\nKindly share them at the earliest${c.dueDate ? ` (by ${formatDate(c.dueDate)})` : ""}.\n\nRegards,\n${firmName}`;
}

export function ChecklistPanel({ checklist: c, firmName, canEdit, onClose }: { checklist: Checklist; firmName: string; canEdit: boolean; onClose: () => void }) {
  const [uploadFor, setUploadFor] = useState<DocItem | null>(null);
  const [noteFor, setNoteFor] = useState<DocItem | null>(null);
  const [newItem, setNewItem] = useState("");
  const [confirmVia, setConfirmVia] = useState<"WhatsApp" | "Email" | null>(null);
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  const run = (fn: () => Promise<ActionResult>, after?: () => void) =>
    start(async () => {
      const r = await fn();
      toast(r.ok ? (r.message ?? "Done") : r.error, r.ok ? "success" : "error");
      if (r.ok) after?.();
      router.refresh();
    });
  const msg = pendingMessage(c, firmName);

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={`${c.clientName} — ${c.title}`}
      description={`${c.category}${c.dueDate ? ` · due ${formatDate(c.dueDate)}` : ""} · Documents Pending: ${c.pending}`}
      footer={
        <>
          {canEdit && <ConfirmDelete label="Delete request" title="Delete this document request?" onConfirm={() => deleteChecklist(c.id)} onDone={onClose} />}
          <span className="flex-1" />
          {canEdit && c.pending > 0 && (
            <>
              <Button variant="secondary" size="sm" icon={<MessageCircle className="h-3.5 w-3.5" />} onClick={() => { window.open(whatsappLink(c.clientMobile, msg), "_blank", "noopener"); setConfirmVia("WhatsApp"); }}>
                Request on WhatsApp
              </Button>
              <Button variant="secondary" size="sm" icon={<Mail className="h-3.5 w-3.5" />} onClick={() => { window.open(mailtoLink(c.clientEmail, `Documents pending — ${c.title}`, msg), "_blank", "noopener"); setConfirmVia("Email"); }}>
                Request by Email
              </Button>
            </>
          )}
          <Button onClick={onClose}>Done</Button>
        </>
      }
    >
      {confirmVia && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-info-line bg-info-bg px-3 py-2 text-sm text-info">
          <span>Sent the request on {confirmVia}? Log it on the client timeline.</span>
          <span className="flex gap-2">
            <Button size="sm" onClick={() => run(() => logDocumentRequest(c.id, confirmVia), () => setConfirmVia(null))}>Log request</Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirmVia(null)}>Dismiss</Button>
          </span>
        </div>
      )}
      <ul className="divide-y divide-line rounded-xl border border-line">
        {c.items.map((d) => (
          <li key={d.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{d.name}</p>
              <p className="truncate text-xs text-ink-3">
                {d.hasFile ? `${d.fileName} · ${formatBytes(d.sizeBytes)}${d.receivedAt ? ` · received ${formatDate(d.receivedAt)}` : ""}` : d.status === "Not Required" ? "Not required this period" : "No file yet"}
              </p>
              {d.notes && <p className="mt-1 text-xs text-gold">Note: {d.notes}</p>}
            </div>
            <div className="flex flex-wrap items-center gap-1">
              {canEdit ? <InlineStatus id={d.id} status={d.status} options={DOCUMENT_STATUSES} action={setDocumentStatus} label={`Status of ${d.name}`} /> : <StatusBadge status={d.status} />}
              {d.hasFile && (
                <>
                  <a href={`/api/documents/${d.id}?inline=1`} target="_blank" rel="noopener" className="rounded-lg p-1.5 text-ink-3 hover:bg-subtle hover:text-ink" aria-label={`View ${d.name}`} title="View">
                    <Eye className="h-4 w-4" />
                  </a>
                  <a href={`/api/documents/${d.id}`} className="rounded-lg p-1.5 text-ink-3 hover:bg-subtle hover:text-ink" aria-label={`Download ${d.name}`} title="Download">
                    <Download className="h-4 w-4" />
                  </a>
                </>
              )}
              {canEdit && (
                <>
                  <button type="button" onClick={() => setUploadFor(d)} className="rounded-lg p-1.5 text-ink-3 hover:bg-subtle hover:text-ink" aria-label={`Upload ${d.name}`} title="Upload">
                    <Upload className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={() => setNoteFor(d)} className="rounded-lg p-1.5 text-ink-3 hover:bg-subtle hover:text-ink" aria-label={`Note for ${d.name}`} title="Add note">
                    <StickyNote className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => run(() => (d.hasFile ? removeDocumentFile(d.id) : deleteDocumentItem(d.id)))}
                    className="rounded-lg p-1.5 text-ink-3 hover:bg-danger-bg hover:text-danger"
                    aria-label={d.hasFile ? `Delete file for ${d.name}` : `Remove ${d.name} from list`}
                    title={d.hasFile ? "Delete file" : "Remove item"}
                  >
                    {d.hasFile ? <Trash2 className="h-4 w-4" /> : <X className="h-4 w-4" />}
                  </button>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
      {canEdit && (
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (newItem.trim()) run(() => addDocumentItem(c.id, newItem), () => setNewItem(""));
          }}
        >
          <Input aria-label="New document name" placeholder="Add another required document…" value={newItem} onChange={(e) => setNewItem(e.target.value)} />
          <Button type="submit" variant="secondary" icon={<Plus className="h-4 w-4" />} disabled={pending || !newItem.trim()}>Add</Button>
        </form>
      )}
      {uploadFor && <UploadForm doc={uploadFor} onDone={() => setUploadFor(null)} />}
      {noteFor && <NoteForm doc={noteFor} onDone={() => setNoteFor(null)} />}
    </Modal>
  );
}

function UploadForm({ doc, onDone }: { doc: { id: string; name: string }; onDone: () => void }) {
  const { formAction, formError, pending } = useFormAction(uploadDocument, { onSuccess: onDone });
  return (
    <Modal
      open
      onClose={onDone}
      size="sm"
      title={`Upload — ${doc.name}`}
      description="PDF, images, Excel, Word, CSV, text or ZIP."
      footer={
        <>
          <Button variant="secondary" onClick={onDone}>Cancel</Button>
          <SubmitButton pending={pending} form="upload-form" pendingLabel="Uploading…">Upload</SubmitButton>
        </>
      }
    >
      <ActionForm id="upload-form" action={formAction}>
        <FormError message={formError} />
        <input type="hidden" name="documentId" value={doc.id} />
        <FilePicker />
        <Checkbox name="partial" label="Only part of this document was received" className="mt-4" />
      </ActionForm>
    </Modal>
  );
}

function FilePicker() {
  const ref = useRef<HTMLInputElement>(null);
  const [name, setName] = useState<string | null>(null);
  return (
    <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line-strong bg-subtle px-4 py-8 text-center hover:border-navy-600">
      <FilePlus2 className="h-6 w-6 text-ink-3" />
      <span className="text-sm font-medium">{name ?? "Choose a file"}</span>
      <span className="text-xs text-ink-3">Stored securely; only signed-in staff can open it.</span>
      <input ref={ref} type="file" name="file" required className="sr-only" accept=".pdf,.png,.jpg,.jpeg,.webp,.csv,.txt,.xls,.xlsx,.doc,.docx,.zip" onChange={(e) => setName(e.target.files?.[0]?.name ?? null)} />
    </label>
  );
}

function NoteForm({ doc, onDone }: { doc: DocItem; onDone: () => void }) {
  const [note, setNote] = useState(doc.notes ?? "");
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  return (
    <Modal
      open
      onClose={onDone}
      size="sm"
      title={`Note — ${doc.name}`}
      footer={
        <>
          <Button variant="secondary" onClick={onDone}>Cancel</Button>
          <Button
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await setDocumentNote(doc.id, note);
                toast(r.ok ? "Note saved" : r.error, r.ok ? "success" : "error");
                if (r.ok) {
                  router.refresh();
                  onDone();
                }
              })
            }
          >
            Save note
          </Button>
        </>
      }
    >
      <Textarea aria-label="Note" value={note} onChange={(e) => setNote(e.target.value)} rows={4} placeholder="e.g. Client will send bank statement after 10th" />
    </Modal>
  );
}

export function NewChecklistModal({ clients, periods, onClose, initialClient }: { clients: { value: string; label: string }[]; periods: string[]; onClose: () => void; initialClient?: string }) {
  const [category, setCategory] = useState("GST");
  const [period, setPeriod] = useState(periods[1] ?? "");
  const [items, setItems] = useState<string[]>(DOC_TEMPLATES.GST!.slice(0, 4));
  const [extra, setExtra] = useState("");
  const { formAction, err, formError, pending } = useFormAction(createChecklist, { onSuccess: onClose });
  const template = [...new Set([...(DOC_TEMPLATES[category] ?? []), ...items])];
  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title="Request documents"
      description="Create a checklist of documents needed from the client for a period."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <SubmitButton pending={pending} form="checklist-form">Create request</SubmitButton>
        </>
      }
    >
      <ActionForm id="checklist-form" action={formAction} noValidate>
        <FormError message={formError} />
        <FormGrid>
          <Field label="Client" htmlFor="dc-client" required error={err("clientId")} className="sm:col-span-2">
            <Select id="dc-client" name="clientId" defaultValue={initialClient ?? ""} options={clients} placeholder="Select a client…" invalid={!!err("clientId")} />
          </Field>
          <Field label="Category" htmlFor="dc-cat">
            <Select
              id="dc-cat"
              name="category"
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setItems((DOC_TEMPLATES[e.target.value] ?? []).slice(0, 4));
              }}
              options={COMPLIANCE_CATEGORIES}
            />
          </Field>
          <Field label="Period" htmlFor="dc-period">
            <Input id="dc-period" name="period" list="dc-periods" value={period} onChange={(e) => setPeriod(e.target.value)} />
            <datalist id="dc-periods">{periods.map((p) => <option key={p} value={p} />)}</datalist>
          </Field>
          <Field label="Title" htmlFor="dc-title" required error={err("title")}>
            <Input key={`${period}-${category}`} id="dc-title" name="title" defaultValue={`${period} ${category}`.trim()} />
          </Field>
          <Field label="Needed by" htmlFor="dc-due">
            <DatePicker id="dc-due" name="dueDate" />
          </Field>
        </FormGrid>
        <div className="mt-5">
          <p className="mb-2 text-[13px] font-medium text-ink-2">Required documents</p>
          {err("items") && <p className="mb-2 text-sm text-danger">{err("items")}</p>}
          <div className="grid gap-1 sm:grid-cols-2">
            {template.map((t) => (
              <label key={t} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-subtle">
                <input type="checkbox" name="items" value={t} checked={items.includes(t)} onChange={(e) => setItems((xs) => (e.target.checked ? [...xs, t] : xs.filter((x) => x !== t)))} className="h-4 w-4 accent-brand" />
                {t}
              </label>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <Input aria-label="Custom document" placeholder="Add a custom document…" value={extra} onChange={(e) => setExtra(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (extra.trim()) { setItems((xs) => [...xs, extra.trim()]); setExtra(""); } } }} />
            <Button variant="secondary" onClick={() => { if (extra.trim()) { setItems((xs) => [...xs, extra.trim()]); setExtra(""); } }}>Add</Button>
          </div>
        </div>
        <Field label="Notes" htmlFor="dc-notes" className="mt-4">
          <Textarea id="dc-notes" name="notes" rows={2} />
        </Field>
      </ActionForm>
    </Modal>
  );
}

/** Quick "Upload Document": pick client → request → item. */
export function QuickUploadModal({ checklists, onClose }: { checklists: Checklist[]; onClose: () => void }) {
  const clients = [...new Map(checklists.map((c) => [c.clientId, c.clientName])).entries()].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label));
  const [clientId, setClientId] = useState("");
  const [checklistId, setChecklistId] = useState("");
  const lists = checklists.filter((c) => c.clientId === clientId);
  const items = lists.find((l) => l.id === checklistId)?.items ?? [];
  const { formAction, err, formError, pending } = useFormAction(uploadDocument, { onSuccess: onClose });
  return (
    <Modal
      open
      onClose={onClose}
      title="Upload Document"
      description="Attach a file to a client's document request."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <SubmitButton pending={pending} form="quick-upload" pendingLabel="Uploading…">Upload</SubmitButton>
        </>
      }
    >
      <ActionForm id="quick-upload" action={formAction}>
        <FormError message={formError} />
        <FormGrid cols={1}>
          <Field label="Client" htmlFor="qu-client" required>
            <Select id="qu-client" value={clientId} onChange={(e) => { setClientId(e.target.value); setChecklistId(""); }} options={clients} placeholder="Select a client…" />
          </Field>
          <Field label="Document request" htmlFor="qu-list" required hint={clientId && !lists.length ? "No requests for this client — create one first." : undefined}>
            <Select id="qu-list" value={checklistId} disabled={!clientId} onChange={(e) => setChecklistId(e.target.value)} options={lists.map((l) => ({ value: l.id, label: l.title }))} placeholder="Select…" />
          </Field>
          <Field label="Document" htmlFor="qu-doc" required error={err("documentId")}>
            <Select id="qu-doc" name="documentId" disabled={!checklistId} options={items.map((i) => ({ value: i.id, label: `${i.name} — ${i.status}` }))} placeholder="Select…" />
          </Field>
        </FormGrid>
        <div className="mt-4">
          <FilePicker />
        </div>
      </ActionForm>
    </Modal>
  );
}

export function DocumentModals({ checklists, clients, periods, firmName, canEdit }: { checklists: Checklist[]; clients: { value: string; label: string }[]; periods: string[]; firmName: string; canEdit: boolean }) {
  const { params, patch } = useUrlState();
  const open = params.get("checklist");
  const c = open ? checklists.find((x) => x.id === open) : null;
  return (
    <>
      {c && <ChecklistPanel key={c.id} checklist={c} firmName={firmName} canEdit={canEdit} onClose={() => patch({ checklist: null })} />}
      {canEdit && params.get("new") === "1" && <NewChecklistModal clients={clients} periods={periods} initialClient={params.get("client") ?? undefined} onClose={() => patch({ new: null, client: null })} />}
      {canEdit && params.get("upload") === "1" && <QuickUploadModal checklists={checklists} onClose={() => patch({ upload: null })} />}
    </>
  );
}

export function DocumentHeaderActions() {
  const { patch } = useUrlState();
  return (
    <>
      <Button variant="secondary" icon={<Upload className="h-4 w-4" />} onClick={() => patch({ upload: "1" })}>Upload Document</Button>
      <Button icon={<Plus className="h-4 w-4" />} onClick={() => patch({ new: "1" })}>Request Documents</Button>
    </>
  );
}
