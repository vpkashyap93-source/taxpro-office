"use client";

import { Plus } from "lucide-react";
import { EVENT_TYPES } from "@/db/schema";
import type { ActionResult } from "@/lib/action-types";
import { deleteEvent, saveEvent } from "@/server/actions/work";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { DatePicker, Field, FormError, FormGrid, Input, Select, SubmitButton, Textarea } from "@/components/ui/form";
import { useFormAction } from "@/components/ui/use-form-action";
import { useUrlState } from "@/components/ui/use-url-state";
import { ConfirmDelete } from "@/components/ui/confirm-delete";

export interface EventInitial {
  id?: string;
  title?: string;
  type?: string;
  clientId?: string | null;
  date?: string;
  startTime?: string | null;
  endTime?: string | null;
  location?: string | null;
  notes?: string | null;
}

function EventModal({ initial, clients, onClose, canEdit }: { initial: EventInitial; clients: { value: string; label: string }[]; onClose: () => void; canEdit: boolean }) {
  const editing = !!initial.id;
  const action = saveEvent.bind(null, initial.id ?? null) as (s: ActionResult, fd: FormData) => Promise<ActionResult>;
  const { formAction, err, formError } = useFormAction(action, { onSuccess: onClose });
  return (
    <Modal
      open
      onClose={onClose}
      title={editing ? "Event" : "Add event"}
      description="Meetings and reminders. Deadlines from other modules appear on the calendar automatically."
      footer={
        canEdit ? (
          <>
            {editing && <ConfirmDelete title="Delete this event?" onConfirm={() => deleteEvent(initial.id!)} onDone={onClose} />}
            <span className="flex-1" />
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <SubmitButton form="event-form">{editing ? "Save" : "Add event"}</SubmitButton>
          </>
        ) : (
          <Button onClick={onClose}>Close</Button>
        )
      }
    >
      <form id="event-form" action={formAction} noValidate>
        <FormError message={formError} />
        <fieldset disabled={!canEdit}>
          <FormGrid>
            <Field label="Title" htmlFor="ev-title" required error={err("title")} className="sm:col-span-2">
              <Input id="ev-title" name="title" defaultValue={initial.title ?? ""} invalid={!!err("title")} />
            </Field>
            <Field label="Type" htmlFor="ev-type">
              <Select id="ev-type" name="type" defaultValue={initial.type ?? "Client Meeting"} options={EVENT_TYPES} />
            </Field>
            <Field label="Client" htmlFor="ev-client">
              <Select id="ev-client" name="clientId" defaultValue={initial.clientId ?? ""} options={clients} placeholder="No client" />
            </Field>
            <Field label="Date" htmlFor="ev-date" required error={err("date")}>
              <DatePicker id="ev-date" name="date" defaultValue={initial.date ?? ""} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Start" htmlFor="ev-start">
                <Input id="ev-start" name="startTime" type="time" defaultValue={initial.startTime ?? ""} />
              </Field>
              <Field label="End" htmlFor="ev-end">
                <Input id="ev-end" name="endTime" type="time" defaultValue={initial.endTime ?? ""} />
              </Field>
            </div>
            <Field label="Location" htmlFor="ev-loc" className="sm:col-span-2">
              <Input id="ev-loc" name="location" defaultValue={initial.location ?? ""} placeholder="Office, client site, video call…" />
            </Field>
            <Field label="Notes" htmlFor="ev-notes" className="sm:col-span-2">
              <Textarea id="ev-notes" name="notes" defaultValue={initial.notes ?? ""} rows={2} />
            </Field>
          </FormGrid>
        </fieldset>
      </form>
    </Modal>
  );
}

export function EventModals({ clients, editing, canEdit, defaultDate }: { clients: { value: string; label: string }[]; editing: EventInitial | null; canEdit: boolean; defaultDate: string }) {
  const { params, patch } = useUrlState();
  return (
    <>
      {canEdit && params.get("new") === "1" && <EventModal canEdit clients={clients} initial={{ date: defaultDate }} onClose={() => patch({ new: null })} />}
      {editing && <EventModal key={editing.id} canEdit={canEdit} clients={clients} initial={editing} onClose={() => patch({ event: null })} />}
    </>
  );
}

export function AddEventButton() {
  const { patch } = useUrlState();
  return (
    <Button icon={<Plus className="h-4 w-4" />} onClick={() => patch({ new: "1" })}>
      Add Event
    </Button>
  );
}
