"use client";

import { useState } from "react";
import { Upload } from "lucide-react";
import { portalUpload } from "@/server/actions/portal";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { ActionForm, FormError, SubmitButton } from "@/components/ui/form";
import { useFormAction } from "@/components/ui/use-form-action";

export function PortalUploadButton({ documentId, name, disabled }: { documentId: string; name: string; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const { formAction, formError, pending } = useFormAction(portalUpload, { onSuccess: () => setOpen(false) });
  return (
    <>
      <Button size="sm" variant="secondary" disabled={disabled} icon={<Upload className="h-3.5 w-3.5" />} onClick={() => setOpen(true)} title={disabled ? "Disabled in staff preview" : undefined}>
        Upload
      </Button>
      {open && (
        <Modal open onClose={() => setOpen(false)} size="sm" title={`Upload ${name}`} footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><SubmitButton pending={pending} form={`pu-${documentId}`} pendingLabel="Uploading…">Upload</SubmitButton></>}>
          <ActionForm id={`pu-${documentId}`} action={formAction}>
            <FormError message={formError} />
            <input type="hidden" name="documentId" value={documentId} />
            <input type="file" name="file" required accept=".pdf,.png,.jpg,.jpeg,.xls,.xlsx,.csv,.zip" aria-label="File" className="block w-full text-sm file:me-3 file:rounded-lg file:border-0 file:bg-navy-900 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white" />
            <p className="mt-2 text-xs text-ink-3">Your file goes directly to your tax consultant&apos;s secure office system.</p>
          </ActionForm>
        </Modal>
      )}
    </>
  );
}
