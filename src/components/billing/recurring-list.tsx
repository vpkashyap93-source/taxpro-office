"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Pencil, Plus } from "lucide-react";
import { toggleRecurring } from "@/server/actions/billing";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useUrlState } from "@/components/ui/use-url-state";
import { RecurringFormModal, type RecurringInitial } from "./recurring-form";

export function RecurringToggle({ id, active, disabled }: { id: string; active: boolean; disabled?: boolean }) {
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      aria-label={`Recurring billing ${active ? "on" : "off"}`}
      disabled={pending || disabled}
      onClick={() =>
        start(async () => {
          const r = await toggleRecurring(id, !active);
          toast(r.ok ? (r.message ?? "Updated") : r.error, r.ok ? "success" : "error");
          router.refresh();
        })
      }
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${active ? "bg-brand" : "bg-line-strong"}`}
    >
      <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${active ? "translate-x-5.5" : "translate-x-0.5"}`} />
    </button>
  );
}

export function RecurringModals({ plans, clients, allClients, defaultNext, defaultGst, defaultDue }: { plans: (RecurringInitial & { id: string })[]; clients: { value: string; label: string }[]; allClients: { value: string; label: string }[]; defaultNext: string; defaultGst: number; defaultDue: number }) {
  const { params, patch } = useUrlState();
  const edit = params.get("edit");
  const isNew = params.get("new") === "1";
  const plan = edit ? plans.find((p) => p.id === edit) : null;
  return (
    <>
      {isNew && (
        <RecurringFormModal
          clients={clients}
          onClose={() => patch({ new: null, client: null })}
          initial={{ clientId: params.get("client") ?? undefined, active: true, frequency: "Monthly", intervalMonths: 1, nextPeriodStart: defaultNext, dueDays: defaultDue, gstRate: defaultGst, items: [] }}
        />
      )}
      {plan && <RecurringFormModal clients={allClients} initial={plan} onClose={() => patch({ edit: null })} />}
    </>
  );
}

export function NewPlanButton() {
  const { patch } = useUrlState();
  return (
    <Button icon={<Plus className="h-4 w-4" />} onClick={() => patch({ new: "1" })}>
      Add Recurring Plan
    </Button>
  );
}

export function EditPlanButton({ id }: { id: string }) {
  const { patch } = useUrlState();
  return (
    <Button variant="ghost" size="sm" icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => patch({ edit: id })}>
      Edit
    </Button>
  );
}
