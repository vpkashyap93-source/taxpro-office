"use client";

import { Plus } from "lucide-react";
import { PRIORITIES, TASK_CATEGORIES, TASK_STATUSES } from "@/db/schema";
import type { ActionResult } from "@/lib/action-types";
import { deleteTask, saveTask } from "@/server/actions/work";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { ActionForm, DatePicker, Field, FormError, FormGrid, Input, Select, SubmitButton, Textarea } from "@/components/ui/form";
import { useFormAction } from "@/components/ui/use-form-action";
import { useUrlState } from "@/components/ui/use-url-state";
import { ConfirmDelete } from "@/components/ui/confirm-delete";

export interface TaskInitial {
  id?: string;
  title?: string;
  clientId?: string | null;
  category?: string;
  assignedTo?: string | null;
  priority?: string;
  dueDate?: string;
  status?: string;
  notes?: string | null;
}

interface Ctx {
  clients: { value: string; label: string }[];
  staff: { value: string; label: string }[];
  today: string;
  me: string;
}

export function TaskFormModal({ initial, ctx, onClose }: { initial: TaskInitial; ctx: Ctx; onClose: () => void }) {
  const editing = !!initial.id;
  const action = saveTask.bind(null, initial.id ?? null) as (s: ActionResult, fd: FormData) => Promise<ActionResult>;
  const { formAction, err, formError, pending } = useFormAction(action, { onSuccess: onClose });
  return (
    <Modal
      open
      onClose={onClose}
      title={editing ? "Edit task" : "Add task"}
      footer={
        <>
          {editing && <ConfirmDelete title="Delete this task?" onConfirm={() => deleteTask(initial.id!)} onDone={onClose} />}
          <span className="flex-1" />
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <SubmitButton pending={pending} form="task-form">{editing ? "Save changes" : "Add task"}</SubmitButton>
        </>
      }
    >
      <ActionForm id="task-form" action={formAction} noValidate>
        <FormError message={formError} />
        <FormGrid>
          <Field label="Task Name" htmlFor="tk-title" required error={err("title")} className="sm:col-span-2">
            <Input id="tk-title" name="title" defaultValue={initial.title ?? ""} invalid={!!err("title")} autoFocus />
          </Field>
          <Field label="Client" htmlFor="tk-client">
            <Select id="tk-client" name="clientId" defaultValue={initial.clientId ?? ""} options={ctx.clients} placeholder="Internal / no client" />
          </Field>
          <Field label="Category" htmlFor="tk-cat">
            <Select id="tk-cat" name="category" defaultValue={initial.category ?? "Other"} options={TASK_CATEGORIES} />
          </Field>
          <Field label="Assigned To" htmlFor="tk-assignee">
            <Select id="tk-assignee" name="assignedTo" defaultValue={initial.assignedTo ?? ctx.me} options={ctx.staff} placeholder="Unassigned" />
          </Field>
          <Field label="Priority" htmlFor="tk-priority">
            <Select id="tk-priority" name="priority" defaultValue={initial.priority ?? "Medium"} options={PRIORITIES} />
          </Field>
          <Field label="Due Date" htmlFor="tk-due" required error={err("dueDate")}>
            <DatePicker id="tk-due" name="dueDate" defaultValue={initial.dueDate ?? ctx.today} invalid={!!err("dueDate")} />
          </Field>
          <Field label="Status" htmlFor="tk-status">
            <Select id="tk-status" name="status" defaultValue={initial.status ?? "Not Started"} options={TASK_STATUSES} />
          </Field>
          <Field label="Notes" htmlFor="tk-notes" className="sm:col-span-2">
            <Textarea id="tk-notes" name="notes" defaultValue={initial.notes ?? ""} rows={3} />
          </Field>
        </FormGrid>
      </ActionForm>
    </Modal>
  );
}

export function TaskModals({ ctx, editing, canEdit }: { ctx: Ctx; editing: TaskInitial | null; canEdit: boolean }) {
  const { params, patch } = useUrlState();
  if (!canEdit) return null;
  return (
    <>
      {params.get("new") === "1" && <TaskFormModal ctx={ctx} initial={{ clientId: params.get("client") }} onClose={() => patch({ new: null, client: null })} />}
      {editing && <TaskFormModal key={editing.id} ctx={ctx} initial={editing} onClose={() => patch({ edit: null })} />}
    </>
  );
}

export function AddTaskButton() {
  const { patch } = useUrlState();
  return (
    <Button icon={<Plus className="h-4 w-4" />} onClick={() => patch({ new: "1" })}>
      Add Task
    </Button>
  );
}
