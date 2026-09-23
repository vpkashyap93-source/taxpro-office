"use client";

import { useActionState } from "react";
import { signIn } from "@/server/actions/session";
import { ActionForm, Field, FormError, Input, SubmitButton } from "@/components/ui/form";
import type { ActionResult } from "@/lib/action-types";

export function LoginForm({ next }: { next?: string }) {
  const [state, action] = useActionState<ActionResult, FormData>(signIn, { ok: true });
  return (
    <ActionForm action={action} className="mt-6 space-y-4" noValidate>
      {!state.ok && <FormError message={state.error} />}
      <input type="hidden" name="next" value={next ?? ""} />
      <Field label="Email" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="username" required defaultValue="varinder@taxpro.demo" />
      </Field>
      <Field label="Password" htmlFor="password">
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </Field>
      <SubmitButton className="h-11 w-full" pendingLabel="Signing in…">
        Sign in
      </SubmitButton>
      <p className="text-center text-xs text-ink-3">Sessions expire automatically. Passwords are stored as salted bcrypt hashes.</p>
    </ActionForm>
  );
}
