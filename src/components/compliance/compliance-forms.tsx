"use client";

import { useMemo, useState } from "react";
import { Layers, Plus } from "lucide-react";
import { COMPLIANCE_CATEGORIES, COMPLIANCE_STATUSES, PRIORITIES } from "@/db/schema";
import type { ActionResult } from "@/lib/action-types";
import { addMonths, parseISODate, toISODate } from "@/lib/dates";
import { bulkCreateCompliance, deleteCompliance, saveCompliance } from "@/server/actions/work";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Checkbox, DatePicker, Field, FormError, FormGrid, Input, Select, SubmitButton, Textarea } from "@/components/ui/form";
import { useFormAction } from "@/components/ui/use-form-action";
import { useUrlState } from "@/components/ui/use-url-state";
import { ConfirmDelete } from "@/components/ui/confirm-delete";

export interface ComplianceType {
  category: string;
  name: string;
  defaultDueDay: number | null;
  periodicity: string;
}

export interface ComplianceInitial {
  id?: string;
  clientId?: string;
  category?: string;
  complianceType?: string;
  period?: string;
  financialYear?: string;
  dueDate?: string;
  assignedTo?: string | null;
  priority?: string;
  status?: string;
  filedDate?: string | null;
  acknowledgement?: string | null;
  notes?: string | null;
}

interface Ctx {
  clients: { value: string; label: string; services?: string[] }[];
  staff: { value: string; label: string }[];
  types: ComplianceType[];
  fy: string;
  periods: string[]; // e.g. ["Sep 2026", "Aug 2026", ...]
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Suggests a due date from the editable master: day N of the month after a monthly period ("Sep 2026"). */
function suggestDue(type: ComplianceType | undefined, period: string): string | null {
  if (!type?.defaultDueDay) return null;
  const m = period.match(/^([A-Za-z]{3})[a-z]* (\d{4})$/);
  if (!m) return null;
  const idx = MONTHS.indexOf(m[1]!.slice(0, 3));
  if (idx < 0) return null;
  const next = addMonths(`${m[2]}-${String(idx + 1).padStart(2, "0")}-01`, 1);
  const d = parseISODate(next);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(type.defaultDueDay, last));
  return toISODate(d);
}

export function ComplianceFormModal({ initial, ctx, onClose }: { initial: ComplianceInitial; ctx: Ctx; onClose: () => void }) {
  const editing = !!initial.id;
  const [category, setCategory] = useState(initial.category ?? "GST");
  const typesFor = ctx.types.filter((t) => t.category === category);
  const [type, setType] = useState(initial.complianceType ?? typesFor[0]?.name ?? "");
  const [period, setPeriod] = useState(initial.period ?? ctx.periods[1] ?? "");
  const [due, setDue] = useState(initial.dueDate ?? "");
  const [dueTouched, setDueTouched] = useState(!!initial.dueDate);
  const [status, setStatus] = useState(initial.status ?? "Not Started");
  const action = saveCompliance.bind(null, initial.id ?? null) as (s: ActionResult, fd: FormData) => Promise<ActionResult>;
  const { formAction, err, formError } = useFormAction(action, { onSuccess: onClose });
  const suggestion = suggestDue(ctx.types.find((t) => t.category === category && t.name === type), period);
  const effectiveDue = dueTouched ? due : (suggestion ?? due);

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={editing ? "Edit compliance" : "New compliance"}
      description="Due dates are your own data — suggestions come from the editable Compliance Types in Settings."
      footer={
        <>
          {editing && <ConfirmDelete title="Delete this compliance task?" onConfirm={() => deleteCompliance(initial.id!)} onDone={onClose} />}
          <span className="flex-1" />
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <SubmitButton form="compliance-form">{editing ? "Save changes" : "Create"}</SubmitButton>
        </>
      }
    >
      <form id="compliance-form" action={formAction} noValidate>
        <FormError message={formError} />
        <FormGrid>
          <Field label="Client" htmlFor="cf-client" required error={err("clientId")} className="sm:col-span-2">
            <Select id="cf-client" name="clientId" defaultValue={initial.clientId ?? ""} options={ctx.clients} placeholder="Select a client…" invalid={!!err("clientId")} />
          </Field>
          <Field label="Category" htmlFor="cf-cat" required>
            <Select
              id="cf-cat"
              name="category"
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setType(ctx.types.find((t) => t.category === e.target.value)?.name ?? "");
              }}
              options={COMPLIANCE_CATEGORIES}
            />
          </Field>
          <Field label="Compliance Type" htmlFor="cf-type" required error={err("complianceType")}>
            {typesFor.length ? (
              <Select id="cf-type" name="complianceType" value={type} onChange={(e) => setType(e.target.value)} options={typesFor.map((t) => t.name)} />
            ) : (
              <Input id="cf-type" name="complianceType" value={type} onChange={(e) => setType(e.target.value)} />
            )}
          </Field>
          <Field label="Period" htmlFor="cf-period" required error={err("period")} hint="e.g. Sep 2026, Q2, AY 2026-27">
            <Input id="cf-period" name="period" list="cf-periods" value={period} onChange={(e) => setPeriod(e.target.value)} invalid={!!err("period")} />
            <datalist id="cf-periods">
              {ctx.periods.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
          </Field>
          <Field label="Financial Year" htmlFor="cf-fy" required error={err("financialYear")}>
            <Input id="cf-fy" name="financialYear" defaultValue={initial.financialYear ?? ctx.fy} />
          </Field>
          <Field label="Due Date" htmlFor="cf-due" required error={err("dueDate")} hint={!dueTouched && suggestion ? "Suggested from Compliance Types — edit if different" : undefined}>
            <DatePicker
              id="cf-due"
              name="dueDate"
              value={effectiveDue}
              invalid={!!err("dueDate")}
              onChange={(e) => {
                setDue(e.target.value);
                setDueTouched(true);
              }}
            />
          </Field>
          <Field label="Assigned To" htmlFor="cf-assignee">
            <Select id="cf-assignee" name="assignedTo" defaultValue={initial.assignedTo ?? ""} options={ctx.staff} placeholder="Unassigned" />
          </Field>
          <Field label="Priority" htmlFor="cf-priority">
            <Select id="cf-priority" name="priority" defaultValue={initial.priority ?? "Medium"} options={PRIORITIES} />
          </Field>
          <Field label="Status" htmlFor="cf-status">
            <Select id="cf-status" name="status" value={status} onChange={(e) => setStatus(e.target.value)} options={COMPLIANCE_STATUSES} />
          </Field>
          {(status === "Filed" || status === "Completed") && (
            <>
              <Field label="Filed / Completed on" htmlFor="cf-filed">
                <DatePicker id="cf-filed" name="filedDate" defaultValue={initial.filedDate ?? ""} />
              </Field>
              <Field label="ARN / Acknowledgement" htmlFor="cf-ack">
                <Input id="cf-ack" name="acknowledgement" defaultValue={initial.acknowledgement ?? ""} className="tnum" />
              </Field>
            </>
          )}
          <Field label="Notes" htmlFor="cf-notes" className="sm:col-span-2">
            <Textarea id="cf-notes" name="notes" defaultValue={initial.notes ?? ""} rows={3} />
          </Field>
        </FormGrid>
      </form>
    </Modal>
  );
}

export function BulkComplianceModal({ ctx, onClose }: { ctx: Ctx; onClose: () => void }) {
  const [category, setCategory] = useState("GST");
  const typesFor = ctx.types.filter((t) => t.category === category);
  const [type, setType] = useState(typesFor[0]?.name ?? "");
  const [period, setPeriod] = useState(ctx.periods[1] ?? "");
  const serviceFor: Record<string, string> = { GST: "GST", ITR: "ITR", TDS: "TDS", CMA: "CMA", ROC: "ROC", Audit: "Audit" };
  const eligible = useMemo(() => ctx.clients.filter((c) => !serviceFor[category] || c.services?.includes(serviceFor[category]!)), [ctx.clients, category]); // eslint-disable-line react-hooks/exhaustive-deps
  const [selected, setSelected] = useState<Set<string>>(() => new Set(eligible.map((c) => c.value)));
  const { formAction, err, formError } = useFormAction(bulkCreateCompliance, { onSuccess: onClose });
  const suggestion = suggestDue(ctx.types.find((t) => t.category === category && t.name === type), period);

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title="Create for multiple clients"
      description="Creates the same compliance item for each selected client. Existing items for the same period are skipped."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <SubmitButton form="bulk-form">Create for {selected.size} clients</SubmitButton>
        </>
      }
    >
      <form id="bulk-form" action={formAction} noValidate>
        <FormError message={formError} />
        <FormGrid>
          <Field label="Category" htmlFor="bk-cat">
            <Select
              id="bk-cat"
              name="category"
              value={category}
              onChange={(e) => {
                const cat = e.target.value;
                setCategory(cat);
                setType(ctx.types.find((t) => t.category === cat)?.name ?? "");
                setSelected(new Set(ctx.clients.filter((c) => !serviceFor[cat] || c.services?.includes(serviceFor[cat]!)).map((c) => c.value)));
              }}
              options={COMPLIANCE_CATEGORIES}
            />
          </Field>
          <Field label="Compliance Type" htmlFor="bk-type" error={err("complianceType")}>
            <Select id="bk-type" name="complianceType" value={type} onChange={(e) => setType(e.target.value)} options={typesFor.map((t) => t.name)} />
          </Field>
          <Field label="Period" htmlFor="bk-period" error={err("period")}>
            <Input id="bk-period" name="period" list="bk-periods" value={period} onChange={(e) => setPeriod(e.target.value)} />
            <datalist id="bk-periods">
              {ctx.periods.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
          </Field>
          <Field label="Financial Year" htmlFor="bk-fy" error={err("financialYear")}>
            <Input id="bk-fy" name="financialYear" defaultValue={ctx.fy} />
          </Field>
          <Field label="Due Date" htmlFor="bk-due" error={err("dueDate")} hint={suggestion ? "Suggested from Compliance Types" : undefined}>
            <DatePicker key={suggestion ?? "none"} id="bk-due" name="dueDate" defaultValue={suggestion ?? ""} />
          </Field>
          <Field label="Priority" htmlFor="bk-priority">
            <Select id="bk-priority" name="priority" defaultValue="Medium" options={PRIORITIES} />
          </Field>
        </FormGrid>
        <Checkbox name="assignToManager" defaultChecked label="Assign to each client's relationship manager" className="mt-4" />
        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[13px] font-medium text-ink-2">Clients ({selected.size} selected)</p>
            <div className="flex gap-3 text-xs">
              <button type="button" className="text-navy-600 hover:underline" onClick={() => setSelected(new Set(eligible.map((c) => c.value)))}>Select {category} clients</button>
              <button type="button" className="text-navy-600 hover:underline" onClick={() => setSelected(new Set())}>Clear</button>
            </div>
          </div>
          {err("clientIds") && <p className="mb-2 text-sm text-danger">{err("clientIds")}</p>}
          <ul className="grid max-h-56 gap-1 overflow-y-auto rounded-xl border border-line p-2 sm:grid-cols-2">
            {ctx.clients.map((c) => (
              <li key={c.value}>
                <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-subtle">
                  <input
                    type="checkbox"
                    name="clientIds"
                    value={c.value}
                    checked={selected.has(c.value)}
                    onChange={(e) => {
                      const n = new Set(selected);
                      if (e.target.checked) n.add(c.value);
                      else n.delete(c.value);
                      setSelected(n);
                    }}
                    className="h-4 w-4 accent-brand"
                  />
                  <span className="truncate">{c.label}</span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      </form>
    </Modal>
  );
}

export function ComplianceModals({ ctx, editing, canEdit }: { ctx: Ctx; editing: ComplianceInitial | null; canEdit: boolean }) {
  const { params, patch } = useUrlState();
  if (!canEdit) return null;
  return (
    <>
      {params.get("new") === "1" && <ComplianceFormModal ctx={ctx} initial={{ clientId: params.get("client") ?? undefined }} onClose={() => patch({ new: null, client: null })} />}
      {params.get("bulk") === "1" && <BulkComplianceModal ctx={ctx} onClose={() => patch({ bulk: null })} />}
      {editing && <ComplianceFormModal key={editing.id} ctx={ctx} initial={editing} onClose={() => patch({ edit: null })} />}
    </>
  );
}

export function ComplianceHeaderActions() {
  const { patch } = useUrlState();
  return (
    <>
      <Button variant="secondary" icon={<Layers className="h-4 w-4" />} onClick={() => patch({ bulk: "1" })}>
        Bulk create
      </Button>
      <Button icon={<Plus className="h-4 w-4" />} onClick={() => patch({ new: "1" })}>
        New Compliance
      </Button>
    </>
  );
}
