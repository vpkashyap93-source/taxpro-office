"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { BellRing, CheckCircle2, Download, Mail, MessageCircle, MoreHorizontal, Pencil, Printer, Send, Wallet, XCircle } from "lucide-react";
import type { ActionResult } from "@/lib/action-types";
import { cancelInvoice, finaliseInvoice, logReminder, markInvoiceSent } from "@/server/actions/billing";
import { Button, LinkButton } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { Popover } from "@/components/layout/popover";

export interface ShareInfo {
  whatsapp: string;
  email: string;
  reminderWhatsapp: string;
  reminderEmail: string;
}

type Pending = { kind: "send" | "reminder"; via: "WhatsApp" | "Email" } | null;

export function InvoiceActions({
  id,
  status,
  outstanding,
  clientId,
  canEdit,
  canPay,
  share,
  hasPayments,
}: {
  id: string;
  status: string;
  outstanding: number;
  clientId: string;
  canEdit: boolean;
  canPay: boolean;
  share: ShareInfo;
  hasPayments: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [busy, start] = useTransition();
  const [confirm, setConfirm] = useState<Pending>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [pdfHint, setPdfHint] = useState(false);
  const isDraft = status === "Draft";
  const isCancelled = status === "Cancelled";

  const run = (fn: () => Promise<ActionResult>, after?: () => void) =>
    start(async () => {
      const r = await fn();
      if (r.ok) {
        if (r.message) toast(r.message);
        after?.();
        router.refresh();
      } else toast(r.error, "error");
    });

  const open = (url: string, next: Pending) => {
    window.open(url, "_blank", "noopener,noreferrer");
    setConfirm(next);
  };

  return (
    <div className="no-print flex flex-wrap items-center gap-2">
      {isDraft && canEdit && (
        <Button variant="success" disabled={busy} icon={<CheckCircle2 className="h-4 w-4" />} onClick={() => run(() => finaliseInvoice(id))}>
          Generate Invoice
        </Button>
      )}
      {!isDraft && !isCancelled && canEdit && (
        <Popover
          label="Send invoice"
          align="left"
          className="w-60 p-1.5"
          trigger={({ toggle, open: o }) => (
            <Button onClick={toggle} aria-expanded={o} icon={<Send className="h-4 w-4" />}>
              Send
            </Button>
          )}
        >
          {(close) => (
            <div>
              <MenuItem icon={<MessageCircle className="h-4 w-4" />} label="Send on WhatsApp" onClick={() => { close(); open(share.whatsapp, { kind: "send", via: "WhatsApp" }); }} />
              <MenuItem icon={<Mail className="h-4 w-4" />} label="Send by Email" onClick={() => { close(); open(share.email, { kind: "send", via: "Email" }); }} />
              <MenuItem icon={<CheckCircle2 className="h-4 w-4" />} label="Mark as shared on Client Portal" onClick={() => { close(); run(() => markInvoiceSent(id, "Portal")); }} />
            </div>
          )}
        </Popover>
      )}
      <Button variant="secondary" icon={<MessageCircle className="h-4 w-4" />} disabled={isCancelled || isDraft} onClick={() => open(share.whatsapp, canEdit ? { kind: "send", via: "WhatsApp" } : null)}>
        WhatsApp
      </Button>
      <Button variant="secondary" icon={<Mail className="h-4 w-4" />} disabled={isCancelled || isDraft} onClick={() => open(share.email, canEdit ? { kind: "send", via: "Email" } : null)}>
        Email
      </Button>
      <Button variant="secondary" icon={<Printer className="h-4 w-4" />} onClick={() => window.print()}>
        Print
      </Button>
      <Button variant="secondary" icon={<Download className="h-4 w-4" />} onClick={() => setPdfHint(true)}>
        Download PDF
      </Button>
      {canPay && outstanding > 0 && !isDraft && !isCancelled && (
        <LinkButton href={`/payments?new=1&client=${clientId}&invoice=${id}`} variant="success" icon={<Wallet className="h-4 w-4" />}>
          Record Payment
        </LinkButton>
      )}
      {canEdit && (
        <Popover
          label="More actions"
          className="w-56 p-1.5"
          trigger={({ toggle, open: o }) => (
            <Button variant="ghost" size="icon" onClick={toggle} aria-expanded={o} aria-label="More actions">
              <MoreHorizontal className="h-4.5 w-4.5" />
            </Button>
          )}
        >
          {(close) => (
            <div>
              {!isCancelled && <MenuItem icon={<Pencil className="h-4 w-4" />} label="Edit invoice" onClick={() => { close(); router.push(`/billing/invoices/${id}/edit`); }} />}
              {outstanding > 0 && !isDraft && !isCancelled && (
                <>
                  <MenuItem icon={<BellRing className="h-4 w-4" />} label="Payment reminder (WhatsApp)" onClick={() => { close(); open(share.reminderWhatsapp, { kind: "reminder", via: "WhatsApp" }); }} />
                  <MenuItem icon={<BellRing className="h-4 w-4" />} label="Payment reminder (Email)" onClick={() => { close(); open(share.reminderEmail, { kind: "reminder", via: "Email" }); }} />
                </>
              )}
              {!isCancelled && (
                <MenuItem danger icon={<XCircle className="h-4 w-4" />} label={isDraft ? "Delete draft" : "Cancel invoice"} onClick={() => { close(); setCancelOpen(true); }} />
              )}
            </div>
          )}
        </Popover>
      )}

      <Modal
        open={!!confirm}
        onClose={() => setConfirm(null)}
        size="sm"
        title={confirm?.kind === "reminder" ? "Log this reminder?" : `Mark as sent via ${confirm?.via}?`}
        description={`${confirm?.via} opened in a new tab with the message pre-filled. Nothing is sent automatically.`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirm(null)}>Not yet</Button>
            <Button
              disabled={busy}
              onClick={() => {
                const c = confirm!;
                run(() => (c.kind === "send" ? markInvoiceSent(id, c.via) : logReminder(id, c.via)), () => setConfirm(null));
              }}
            >
              {confirm?.kind === "reminder" ? "Yes, log reminder" : "Yes, I sent it"}
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-2">Confirm once you have actually sent the message, so the Bill Tracker and client timeline stay accurate.</p>
      </Modal>

      <Modal
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        size="sm"
        title={isDraft ? "Delete this draft?" : "Cancel this invoice?"}
        description={isDraft ? "The draft will be removed." : "The invoice number is retained for audit and the invoice is excluded from billing totals."}
        footer={
          <>
            <Button variant="secondary" onClick={() => setCancelOpen(false)}>Keep</Button>
            <Button variant="danger" disabled={busy || hasPayments} onClick={() => run(() => cancelInvoice(id), () => { setCancelOpen(false); if (isDraft) router.push("/billing"); })}>
              {isDraft ? "Delete draft" : "Cancel invoice"}
            </Button>
          </>
        }
      >
        {hasPayments ? <p className="text-sm text-danger">This invoice has payments recorded, so it cannot be cancelled. Delete the payments first.</p> : <p className="text-sm text-ink-2">This action is recorded in the activity log.</p>}
      </Modal>

      <Modal
        open={pdfHint}
        onClose={() => setPdfHint(false)}
        size="sm"
        title="Download as PDF"
        footer={
          <Button
            onClick={() => {
              setPdfHint(false);
              setTimeout(() => window.print(), 150);
            }}
          >
            Open print dialog
          </Button>
        }
      >
        <p className="text-sm text-ink-2">
          The invoice is laid out for A4. In the print dialog choose <strong>“Save as PDF”</strong> as the destination to download it. Only the invoice is included — menus and buttons are hidden.
        </p>
      </Modal>
    </div>
  );
}

function MenuItem({ icon, label, onClick, danger }: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button type="button" onClick={onClick} className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm ${danger ? "text-danger hover:bg-danger-bg" : "text-ink-2 hover:bg-subtle"}`}>
      {icon}
      {label}
    </button>
  );
}
