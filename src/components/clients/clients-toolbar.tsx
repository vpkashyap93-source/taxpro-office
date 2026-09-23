"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUrlState } from "@/components/ui/use-url-state";
import type { Option } from "@/server/queries/common";
import { ClientFormModal, type ClientFormValues } from "./client-form";

/** Owns the Add/Edit client modal, driven by ?new=1 or ?edit=<id>. */
export function ClientModals({ staff, defaultFy, editing, canEdit }: { staff: Option[]; defaultFy: string; editing: ClientFormValues | null; canEdit: boolean }) {
  const { params, patch } = useUrlState();
  const isNew = params.get("new") === "1";
  if (!canEdit) return null;
  return (
    <>
      {isNew && <ClientFormModal open onClose={() => patch({ new: null })} staff={staff} defaultFy={defaultFy} />}
      {editing && <ClientFormModal open onClose={() => patch({ edit: null })} staff={staff} defaultFy={defaultFy} initial={editing} />}
    </>
  );
}

export function AddClientButton() {
  const { patch } = useUrlState();
  return (
    <Button onClick={() => patch({ new: "1" })} icon={<Plus className="h-4 w-4" />}>
      Add Client
    </Button>
  );
}
