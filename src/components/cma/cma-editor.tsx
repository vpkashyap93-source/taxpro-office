"use client";

import { useMemo, useState } from "react";
import { CMA_STATUSES } from "@/db/schema";
import type { ActionResult } from "@/lib/action-types";
import { benchmarkState, CMA_INPUT_FIELDS, computeCma, type CmaInputs } from "@/lib/cma";
import { formatMetric } from "@/lib/format";
import { saveCma } from "@/server/actions/cma";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ActionForm, DatePicker, Field, FormError, FormGrid, Input, MoneyInput, Select, SubmitButton, Textarea } from "@/components/ui/form";
import { useFormAction } from "@/components/ui/use-form-action";
import { cn } from "@/lib/cn";

export interface CmaInitial {
  id?: string;
  clientId?: string;
  financialYear: string;
  period: string;
  purpose?: string;
  bank?: string | null;
  loanAmount?: number | null; // paise
  status?: string;
  dueDate?: string | null;
  assignedTo?: string | null;
  notes?: string | null;
  inputs: CmaInputs;
}

const GROUPS = [...new Set(CMA_INPUT_FIELDS.map((f) => f.group))];

export function CmaEditor({ initial, clients, staff }: { initial: CmaInitial; clients: { value: string; label: string }[]; staff: { value: string; label: string }[] }) {
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(CMA_INPUT_FIELDS.map((f) => [f.key, initial.inputs[f.key] !== undefined ? String(initial.inputs[f.key]) : ""])));
  const action = saveCma.bind(null, initial.id ?? null) as (s: ActionResult<{ id: string }>, fd: FormData) => Promise<ActionResult<{ id: string }>>;
  const { formAction, err, formError } = useFormAction<{ id: string }>(action);
  const inputs = useMemo(() => {
    const o: CmaInputs = {};
    for (const [k, v] of Object.entries(values)) {
      const n = Number(v.replace(/,/g, ""));
      if (v.trim() !== "" && Number.isFinite(n)) o[k as keyof CmaInputs] = n;
    }
    return o;
  }, [values]);
  const metrics = computeCma(inputs);
  const inputsJson = JSON.stringify(inputs);

  return (
    <ActionForm action={formAction} noValidate className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_380px]">
      <input type="hidden" name="inputs" value={inputsJson} />
      <div className="space-y-6">
        <FormError message={formError} />
        <Card>
          <CardHeader title="Case details" />
          <CardBody>
            <FormGrid>
              <Field label="Client" htmlFor="cma-client" required error={err("clientId")} className="sm:col-span-2">
                <Select id="cma-client" name="clientId" defaultValue={initial.clientId ?? ""} options={clients} placeholder="Select a client…" invalid={!!err("clientId")} />
              </Field>
              <Field label="Purpose" htmlFor="cma-purpose" required error={err("purpose")}>
                <Input id="cma-purpose" name="purpose" defaultValue={initial.purpose ?? ""} placeholder="e.g. CC limit enhancement" invalid={!!err("purpose")} />
              </Field>
              <Field label="Bank / Institution" htmlFor="cma-bank">
                <Input id="cma-bank" name="bank" defaultValue={initial.bank ?? ""} />
              </Field>
              <Field label="Financial Year" htmlFor="cma-fy" required error={err("financialYear")}>
                <Input id="cma-fy" name="financialYear" defaultValue={initial.financialYear} />
              </Field>
              <Field label="Period" htmlFor="cma-period" required error={err("period")}>
                <Input id="cma-period" name="period" defaultValue={initial.period} />
              </Field>
              <Field label="Loan / Limit applied" htmlFor="cma-loan" error={err("loanAmount")}>
                <MoneyInput id="cma-loan" name="loanAmount" defaultValue={initial.loanAmount ? String(initial.loanAmount / 100) : ""} />
              </Field>
              <Field label="Status" htmlFor="cma-status">
                <Select id="cma-status" name="status" defaultValue={initial.status ?? "Draft"} options={CMA_STATUSES} />
              </Field>
              <Field label="Target date" htmlFor="cma-due">
                <DatePicker id="cma-due" name="dueDate" defaultValue={initial.dueDate ?? ""} />
              </Field>
              <Field label="Assigned To" htmlFor="cma-assignee">
                <Select id="cma-assignee" name="assignedTo" defaultValue={initial.assignedTo ?? ""} options={staff} placeholder="Unassigned" />
              </Field>
              <Field label="Notes" htmlFor="cma-notes" className="sm:col-span-2">
                <Textarea id="cma-notes" name="notes" defaultValue={initial.notes ?? ""} rows={2} />
              </Field>
            </FormGrid>
          </CardBody>
        </Card>
        {GROUPS.map((g) => (
          <Card key={g}>
            <CardHeader title={g} subtitle="Amounts in ₹ (whole rupees)" />
            <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {CMA_INPUT_FIELDS.filter((f) => f.group === g).map((f) => (
                <Field key={f.key} label={f.label} htmlFor={`in-${f.key}`}>
                  <MoneyInput id={`in-${f.key}`} value={values[f.key]} onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))} className="text-right" placeholder="0" />
                </Field>
              ))}
            </CardBody>
          </Card>
        ))}
      </div>
      <div>
        <Card className="xl:sticky xl:top-24">
          <CardHeader title="Live calculations" subtitle="Recomputed from the inputs — formulas shown on the report" />
          <CardBody className="max-h-[60vh] space-y-1 overflow-y-auto pt-0 xl:max-h-[calc(100vh-260px)]">
            {metrics.map((m) => {
              const b = benchmarkState(m);
              return (
                <div key={m.key} className="flex items-baseline justify-between gap-3 border-b border-line py-1.5 text-sm last:border-0">
                  <span className="text-ink-2" title={m.formula}>{m.label}</span>
                  <span className={cn("tnum font-medium", b === "warn" ? "text-warn" : b === "ok" ? "text-brand" : "text-ink")}>{formatMetric(m.value, m.format)}</span>
                </div>
              );
            })}
          </CardBody>
          <div className="flex flex-col gap-2 border-t border-line p-4">
            <SubmitButton className="w-full" name="intent" value="view">Save & view report</SubmitButton>
            <button type="submit" name="intent" value="stay" className="h-9.5 rounded-lg border border-line-strong text-sm font-medium hover:bg-subtle">Save Draft</button>
          </div>
        </Card>
      </div>
    </ActionForm>
  );
}
