"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Copy, Download, FileCheck2, Pencil, Printer } from "lucide-react";
import { deleteCma, duplicateCma, markCmaReportGenerated } from "@/server/actions/cma";
import { Button, LinkButton } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { ConfirmDelete } from "@/components/ui/confirm-delete";
import { useToast } from "@/components/ui/toast";

export function CmaActions({ id, canEdit, generated }: { id: string; canEdit: boolean; generated: boolean }) {
  const [pending, start] = useTransition();
  const [pdf, setPdf] = useState(false);
  const toast = useToast();
  const router = useRouter();
  return (
    <div className="no-print flex flex-wrap gap-2">
      {canEdit && <LinkButton href={`/cma/${id}/edit`} variant="secondary" icon={<Pencil className="h-4 w-4" />}>Edit</LinkButton>}
      {canEdit && (
        <Button variant="secondary" disabled={pending} icon={<Copy className="h-4 w-4" />} onClick={() => start(async () => { const r = await duplicateCma(id); if (r && !r.ok) toast(r.error, "error"); })}>
          Duplicate
        </Button>
      )}
      {canEdit && (
        <Button
          variant="success"
          disabled={pending}
          icon={<FileCheck2 className="h-4 w-4" />}
          onClick={() => start(async () => { const r = await markCmaReportGenerated(id); toast(r.ok ? (r.message ?? "Done") : r.error, r.ok ? "success" : "error"); router.refresh(); })}
        >
          {generated ? "Regenerate Report" : "Generate Report"}
        </Button>
      )}
      <Button variant="secondary" icon={<Printer className="h-4 w-4" />} onClick={() => window.print()}>Print</Button>
      <Button variant="secondary" icon={<Download className="h-4 w-4" />} onClick={() => setPdf(true)}>PDF</Button>
      {canEdit && <ConfirmDelete title="Delete this CMA case?" onConfirm={() => deleteCma(id)} />}
      <Modal open={pdf} onClose={() => setPdf(false)} size="sm" title="Download as PDF" footer={<Button onClick={() => { setPdf(false); setTimeout(() => window.print(), 150); }}>Open print dialog</Button>}>
        <p className="text-sm text-ink-2">Choose <strong>“Save as PDF”</strong> in the print dialog. The report is formatted for A4.</p>
      </Modal>
    </div>
  );
}
