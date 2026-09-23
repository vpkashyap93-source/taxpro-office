"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Copy, KeyRound } from "lucide-react";
import { disablePortalAccess, enablePortalAccess } from "@/server/actions/admin";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Field, FormError, Input } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";

export function PortalAccessButton({ clientId, clientName, email, enabled }: { clientId: string; clientName: string; email: string | null; enabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(email ?? "");
  const [error, setError] = useState<string | null>(null);
  const [creds, setCreds] = useState<{ email: string; tempPassword: string } | null>(null);
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  const close = () => { setOpen(false); setCreds(null); setError(null); };
  return (
    <>
      <div className="flex justify-end gap-2">
        <Button size="sm" variant={enabled ? "secondary" : "primary"} icon={<KeyRound className="h-3.5 w-3.5" />} onClick={() => setOpen(true)}>{enabled ? "Reset" : "Enable"}</Button>
        {enabled && (
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => start(async () => { const r = await disablePortalAccess(clientId); toast(r.ok ? (r.message ?? "") : r.error, r.ok ? "success" : "error"); router.refresh(); })}>
            Disable
          </Button>
        )}
      </div>
      <Modal
        open={open}
        onClose={close}
        size="sm"
        title={creds ? "Portal login ready" : `${enabled ? "Reset" : "Enable"} portal access — ${clientName}`}
        footer={creds ? <Button onClick={close}>Done</Button> : (
          <>
            <Button variant="secondary" onClick={close}>Cancel</Button>
            <Button disabled={pending} onClick={() => start(async () => {
              const r = await enablePortalAccess(clientId, value);
              if (r.ok && r.data) { setCreds(r.data); router.refresh(); } else if (!r.ok) setError(r.error);
            })}>{pending ? "Working…" : "Create login"}</Button>
          </>
        )}
      >
        {creds ? (
          <div className="space-y-3 text-sm">
            <p className="text-ink-2">Share these credentials with the client privately. The password is shown only once.</p>
            <div className="rounded-lg border border-line bg-subtle p-3 font-mono text-[13px]">
              <p>Login: {creds.email}</p>
              <p>Password: {creds.tempPassword}</p>
            </div>
            <Button size="sm" variant="secondary" icon={<Copy className="h-3.5 w-3.5" />} onClick={() => { navigator.clipboard?.writeText(`Portal: ${location.origin}/login\nLogin: ${creds.email}\nPassword: ${creds.tempPassword}`); toast("Copied"); }}>Copy details</Button>
          </div>
        ) : (
          <>
            <FormError message={error} />
            <Field label="Client login email" htmlFor="pa-email" hint="A new temporary password will be generated.">
              <Input id="pa-email" type="email" value={value} onChange={(e) => setValue(e.target.value)} />
            </Field>
          </>
        )}
      </Modal>
    </>
  );
}
