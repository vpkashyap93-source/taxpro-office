"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deletePayment } from "@/server/actions/billing";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";

export function DeletePaymentButton({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  return (
    <>
      <Button variant="ghost" size="icon" aria-label="Delete payment" onClick={() => setOpen(true)}>
        <Trash2 className="h-4 w-4" />
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        size="sm"
        title="Delete this payment?"
        description="The invoice balance will increase by this amount. This is recorded in the activity log."
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              variant="danger"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await deletePayment(id);
                  toast(r.ok ? (r.message ?? "Deleted") : r.error, r.ok ? "success" : "error");
                  if (r.ok) {
                    setOpen(false);
                    router.refresh();
                  }
                })
              }
            >
              Delete payment
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-2">Only delete a payment that was recorded by mistake.</p>
      </Modal>
    </>
  );
}
