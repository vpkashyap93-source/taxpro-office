"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import type { ActionResult } from "@/lib/action-types";
import { Button } from "./button";
import { Modal } from "./modal";
import { useToast } from "./toast";

export function ConfirmDelete({ onConfirm, title, description, label = "Delete", onDone }: { onConfirm: () => Promise<ActionResult>; title: string; description?: string; label?: string; onDone?: () => void }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  return (
    <>
      <Button variant="danger" size="sm" icon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => setOpen(true)}>
        {label}
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        size="sm"
        title={title}
        description={description}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              variant="danger"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await onConfirm();
                  toast(r.ok ? (r.message ?? "Deleted") : r.error, r.ok ? "success" : "error");
                  if (r.ok) {
                    setOpen(false);
                    onDone?.();
                    router.refresh();
                  }
                })
              }
            >
              {pending ? "Deleting…" : label}
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-2">This is recorded in the activity log and cannot be undone.</p>
      </Modal>
    </>
  );
}
