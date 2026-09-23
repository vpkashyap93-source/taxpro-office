"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Copy, Plus, ShieldCheck } from "lucide-react";
import { ROLES } from "@/db/schema";
import type { ActionResult } from "@/lib/action-types";
import { ACCESS_LEVELS, ADMIN_LOCKED, MODULE_LABELS, MODULES, STAFF_ROLES, type PermissionMatrix } from "@/lib/permissions";
import { savePermissions, saveUser } from "@/server/actions/admin";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { ActionForm, Checkbox, Field, FormError, FormGrid, Input, Select, SubmitButton } from "@/components/ui/form";
import { useFormAction } from "@/components/ui/use-form-action";
import { useUrlState } from "@/components/ui/use-url-state";
import { useToast } from "@/components/ui/toast";
import { Card, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/cn";

export interface Member {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  designation: string | null;
  active: boolean;
}

function MemberModal({ initial, onClose }: { initial: Partial<Member>; onClose: () => void }) {
  const editing = !!initial.id;
  const [temp, setTemp] = useState<string | null>(null);
  const action = saveUser.bind(null, initial.id ?? null) as (s: ActionResult<{ tempPassword?: string }>, fd: FormData) => Promise<ActionResult<{ tempPassword?: string }>>;
  const { formAction, err, formError, pending } = useFormAction<{ tempPassword?: string }>(action, {
    onSuccess: (d) => (d?.tempPassword ? setTemp(d.tempPassword) : onClose()),
  });
  const toast = useToast();
  if (temp)
    return (
      <Modal open onClose={onClose} size="sm" title="Team member added" footer={<Button onClick={onClose}>Done</Button>}>
        <p className="text-sm text-ink-2">Share this temporary password privately. It is shown only once; ask them to change it from <strong>My Account</strong> after signing in.</p>
        <div className="mt-4 flex items-center justify-between rounded-lg border border-line bg-subtle px-3 py-2.5">
          <code className="tnum font-mono text-sm">{temp}</code>
          <Button size="sm" variant="ghost" icon={<Copy className="h-3.5 w-3.5" />} onClick={() => { navigator.clipboard?.writeText(temp); toast("Copied"); }}>Copy</Button>
        </div>
      </Modal>
    );
  return (
    <Modal
      open
      onClose={onClose}
      title={editing ? `Edit ${initial.name}` : "Add team member"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <SubmitButton pending={pending} form="member-form">{editing ? "Save" : "Add member"}</SubmitButton>
        </>
      }
    >
      <ActionForm id="member-form" action={formAction} noValidate>
        <FormError message={formError} />
        <FormGrid>
          <Field label="Name" htmlFor="mb-name" required error={err("name")}>
            <Input id="mb-name" name="name" defaultValue={initial.name ?? ""} invalid={!!err("name")} />
          </Field>
          <Field label="Email (login)" htmlFor="mb-email" required error={err("email")}>
            <Input id="mb-email" name="email" type="email" defaultValue={initial.email ?? ""} invalid={!!err("email")} />
          </Field>
          <Field label="Mobile" htmlFor="mb-phone" error={err("phone")}>
            <Input id="mb-phone" name="phone" defaultValue={initial.phone ?? ""} />
          </Field>
          <Field label="Designation" htmlFor="mb-desig">
            <Input id="mb-desig" name="designation" defaultValue={initial.designation ?? ""} />
          </Field>
          <Field label="Role" htmlFor="mb-role" required>
            <Select id="mb-role" name="role" defaultValue={initial.role ?? "Junior"} options={ROLES.filter((r) => r !== "Client")} />
          </Field>
          <Field label={editing ? "Set new password" : "Password"} htmlFor="mb-pass" error={err("password")} hint={editing ? "Leave blank to keep the current password" : "Leave blank to generate a temporary password"}>
            <Input id="mb-pass" name="password" type="password" autoComplete="new-password" />
          </Field>
        </FormGrid>
        <Checkbox name="active" defaultChecked={initial.active ?? true} label="Active (can sign in)" className="mt-4" />
      </ActionForm>
    </Modal>
  );
}

export function TeamModals({ members, canEdit }: { members: Member[]; canEdit: boolean }) {
  const { params, patch } = useUrlState();
  if (!canEdit) return null;
  const edit = params.get("edit");
  const m = edit ? members.find((x) => x.id === edit) : null;
  return (
    <>
      {params.get("new") === "1" && <MemberModal initial={{}} onClose={() => patch({ new: null })} />}
      {m && <MemberModal key={m.id} initial={m} onClose={() => patch({ edit: null })} />}
    </>
  );
}

export function AddMemberButton() {
  const { patch } = useUrlState();
  return <Button icon={<Plus className="h-4 w-4" />} onClick={() => patch({ new: "1" })}>Add Member</Button>;
}

const LEVEL_STYLE: Record<string, string> = { none: "text-ink-4", view: "text-info", edit: "text-brand font-medium" };

export function PermissionMatrixEditor({ initial, canEdit }: { initial: PermissionMatrix; canEdit: boolean }) {
  const [m, setM] = useState(initial);
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  const dirty = JSON.stringify(m) !== JSON.stringify(initial);
  return (
    <Card>
      <CardHeader
        title="Role permissions"
        subtitle="Juniors have no access to billing, payments, reports or settings by default. Admin always keeps Team and Settings."
        icon={<ShieldCheck className="h-4 w-4" />}
        action={
          canEdit ? (
            <Button
              disabled={!dirty || pending}
              onClick={() =>
                start(async () => {
                  const r = await savePermissions(m);
                  toast(r.ok ? (r.message ?? "Saved") : r.error, r.ok ? "success" : "error");
                  router.refresh();
                })
              }
            >
              {pending ? "Saving…" : "Save permissions"}
            </Button>
          ) : undefined
        }
      />
      <div className="scrollbar-thin overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">Permissions by role and module</caption>
          <thead>
            <tr className="border-y border-line bg-subtle">
              <th scope="col" className="px-5 py-2.5 text-left text-[11.5px] font-semibold tracking-[0.06em] text-ink-3 uppercase">Module</th>
              {STAFF_ROLES.map((r) => (
                <th key={r} scope="col" className="px-3 py-2.5 text-left text-[11.5px] font-semibold tracking-[0.06em] whitespace-nowrap text-ink-3 uppercase">{r}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MODULES.map((mod) => (
              <tr key={mod} className="border-b border-line last:border-0">
                <th scope="row" className="px-5 py-2 text-left font-medium text-ink">{MODULE_LABELS[mod]}</th>
                {STAFF_ROLES.map((role) => {
                  const locked = role === "Admin" && ADMIN_LOCKED.includes(mod);
                  return (
                    <td key={role} className="px-3 py-1.5">
                      {canEdit && !locked ? (
                        <select
                          aria-label={`${role} access to ${MODULE_LABELS[mod]}`}
                          value={m[role][mod]}
                          onChange={(e) => setM((x) => ({ ...x, [role]: { ...x[role], [mod]: e.target.value } }))}
                          className={cn("h-8 rounded-md border border-line bg-surface px-2 text-[13px] capitalize", LEVEL_STYLE[m[role][mod]])}
                        >
                          {ACCESS_LEVELS.map((l) => <option key={l} value={l}>{l === "none" ? "No access" : l === "view" ? "View" : "Edit"}</option>)}
                        </select>
                      ) : (
                        <span className={cn("text-[13px] capitalize", LEVEL_STYLE[m[role][mod]])}>{m[role][mod] === "none" ? "No access" : m[role][mod]}{locked ? " (locked)" : ""}</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
