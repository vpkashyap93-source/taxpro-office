"use client";

import { useActionState, useEffect, useRef } from "react";
import type { ActionResult } from "@/lib/action-types";
import { useToast } from "./toast";

/**
 * useActionState + success toast + callback. Field errors are exposed via `err(name)`.
 */
export function useFormAction<T>(
  action: (state: ActionResult<T>, fd: FormData) => Promise<ActionResult<T>>,
  opts: { onSuccess?: (data?: T) => void } = {},
) {
  const [state, formAction, pending] = useActionState<ActionResult<T>, FormData>(action, { ok: true });
  const toast = useToast();
  const first = useRef(true);
  const cb = useRef(opts.onSuccess);
  useEffect(() => {
    cb.current = opts.onSuccess;
  });
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (state.ok) {
      if (state.message) toast(state.message);
      cb.current?.(state.data);
    }
  }, [state, toast]);
  const err = (name: string) => (!state.ok ? state.fieldErrors?.[name]?.[0] : undefined);
  return { state, formAction, pending, err, formError: !state.ok ? state.error : null };
}
