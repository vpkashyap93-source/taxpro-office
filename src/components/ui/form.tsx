"use client";

import { useFormStatus } from "react-dom";
import { AlertCircle } from "lucide-react";
import { createContext, useContext, useTransition, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Button, type ButtonVariant } from "./button";

export const inputClass =
  "block w-full h-9.5 rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink placeholder:text-ink-4 transition-colors hover:border-ink-4 focus:border-navy-600 focus:outline-none focus:ring-3 focus:ring-navy-600/15 disabled:bg-subtle disabled:text-ink-3 aria-[invalid=true]:border-danger aria-[invalid=true]:ring-danger/10";

export function Field({
  label,
  htmlFor,
  error,
  hint,
  required,
  children,
  className,
}: {
  label: ReactNode;
  htmlFor?: string;
  error?: string | string[];
  hint?: ReactNode;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const msg = Array.isArray(error) ? error[0] : error;
  return (
    <div className={cn("min-w-0", className)}>
      <label htmlFor={htmlFor} className="mb-1.5 block text-[13px] font-medium text-ink-2">
        {label}
        {required && <span className="ms-0.5 text-danger" aria-hidden>*</span>}
      </label>
      {children}
      {msg ? (
        <p className="mt-1.5 flex items-center gap-1 text-xs text-danger" role="alert">
          <AlertCircle className="h-3.5 w-3.5" aria-hidden />
          {msg}
        </p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-ink-3">{hint}</p>
      ) : null}
    </div>
  );
}

export function Input({ className, invalid, ...rest }: ComponentProps<"input"> & { invalid?: boolean }) {
  return <input aria-invalid={invalid || undefined} className={cn(inputClass, className)} {...rest} />;
}

/** Styled native date input: keyboard accessible and uses the OS date picker on mobile. */
export function DatePicker({ className, invalid, ...rest }: Omit<ComponentProps<"input">, "type"> & { invalid?: boolean }) {
  return <input type="date" aria-invalid={invalid || undefined} className={cn(inputClass, "tnum", className)} {...rest} />;
}

export function MoneyInput({ className, invalid, ...rest }: ComponentProps<"input"> & { invalid?: boolean }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-ink-3">₹</span>
      <input inputMode="decimal" aria-invalid={invalid || undefined} className={cn(inputClass, "tnum ps-7", className)} {...rest} />
    </div>
  );
}

export function Select({
  className,
  invalid,
  options,
  placeholder,
  ...rest
}: ComponentProps<"select"> & {
  invalid?: boolean;
  options: readonly (string | { value: string; label: string })[];
  placeholder?: string;
}) {
  return (
    <select aria-invalid={invalid || undefined} className={cn(inputClass, "appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%236f7c8f%22 stroke-width=%222.5%22><path d=%22m6 9 6 6 6-6%22/></svg>')] bg-[length:12px] bg-[right_12px_center] bg-no-repeat pe-8", className)} {...rest}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((o) =>
        typeof o === "string" ? (
          <option key={o} value={o}>
            {o}
          </option>
        ) : (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ),
      )}
    </select>
  );
}

export function Textarea({ className, ...rest }: ComponentProps<"textarea">) {
  return <textarea className={cn(inputClass, "h-auto min-h-20 py-2", className)} {...rest} />;
}

export function Checkbox({ label, className, ...rest }: ComponentProps<"input"> & { label: ReactNode }) {
  return (
    <label className={cn("inline-flex cursor-pointer items-center gap-2 text-sm text-ink-2", className)}>
      <input type="checkbox" className="h-4 w-4 rounded border-line-strong accent-brand" {...rest} />
      {label}
    </label>
  );
}

export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <div role="alert" className="mb-4 flex items-start gap-2 rounded-lg border border-danger-line bg-danger-bg px-3 py-2.5 text-sm text-danger">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <span>{message}</span>
    </div>
  );
}

const PendingCtx = createContext<boolean | null>(null);

/**
 * <form> for server actions that does NOT auto-reset on submit (React 19 resets forms passed an
 * `action`, which would wipe the user's input when validation fails). Submits in a transition.
 */
export function ActionForm({ action, children, ...rest }: Omit<ComponentProps<"form">, "action" | "onSubmit"> & { action: (fd: FormData) => void }) {
  const [pending, start] = useTransition();
  return (
    <PendingCtx.Provider value={pending}>
      <form
        noValidate
        method="post" // if JS hasn't loaded, never fall back to GET (would put fields such as passwords in the URL)
        {...rest}
        aria-busy={pending}
        onSubmit={(e) => {
          e.preventDefault();
          const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLElement | null;
          const fd = new FormData(e.currentTarget, submitter);
          start(() => action(fd));
        }}
      >
        {children}
      </form>
    </PendingCtx.Provider>
  );
}

/** Submit button that reflects the parent form's pending state. */
export function SubmitButton({ children, variant = "primary", pendingLabel = "Saving…", className, form, name, value, pending: pendingProp }: { children: ReactNode; variant?: ButtonVariant; pendingLabel?: string; className?: string; form?: string; name?: string; value?: string; pending?: boolean }) {
  const status = useFormStatus();
  const ctx = useContext(PendingCtx);
  const pending = pendingProp ?? ctx ?? status.pending;
  return (
    <Button type="submit" variant={variant} disabled={pending} aria-busy={pending} className={className} form={form} name={name} value={value}>
      {pending && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden />}
      {pending ? pendingLabel : children}
    </Button>
  );
}

export function FormGrid({ children, cols = 2, className }: { children: ReactNode; cols?: 1 | 2 | 3; className?: string }) {
  const c = { 1: "sm:grid-cols-1", 2: "sm:grid-cols-2", 3: "sm:grid-cols-3" }[cols];
  return <div className={cn("grid grid-cols-1 gap-4", c, className)}>{children}</div>;
}

export function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="mb-6 last:mb-0">
      <legend className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-ink-3">{title}</legend>
      {children}
    </fieldset>
  );
}
