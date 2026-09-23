"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deleteClient } from "@/server/actions/clients";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { FormError } from "@/components/ui/form";

export function DeleteClientButton({ id, name }: { id: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <>
      <Button variant="danger" size="sm" icon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => setOpen(true)}>
        Delete client
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        size="sm"
        title={`Delete ${name}?`}
        description="This permanently removes the client and their compliance, documents and tasks."
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              variant="danger"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await deleteClient(id);
                  if (r && !r.ok) setError(r.error);
                })
              }
            >
              {pending ? "Deleting…" : "Delete permanently"}
            </Button>
          </>
        }
      >
        <FormError message={error} />
        <p className="text-sm text-ink-2">Clients with invoices or payments cannot be deleted — mark them Inactive instead to preserve the financial history.</p>
      </Modal>
    </>
  );
}
