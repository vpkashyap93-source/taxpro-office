import "server-only";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/lib/action-types";
import { zodFieldErrors } from "@/lib/validation";
import { AuthError } from "./auth";

export class UserError extends Error {}

/**
 * Wraps a server action body: converts validation/auth/user errors into ActionResult,
 * logs unexpected errors without leaking internals, and refreshes rendered data on success.
 */
export async function runAction<T = undefined>(fn: () => Promise<ActionResult<T>> | ActionResult<T>): Promise<ActionResult<T>> {
  try {
    const result = await fn();
    if (result.ok) revalidatePath("/", "layout");
    return result;
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false, error: "Please correct the highlighted fields.", fieldErrors: zodFieldErrors(e) };
    if (e instanceof AuthError || e instanceof UserError) return { ok: false, error: e.message };
    if (isUniqueViolation(e)) return { ok: false, error: "A record with the same unique value already exists." };
    if (isDigestError(e)) throw e; // let Next.js redirects/notFound propagate
    console.error("[action] unexpected error", e);
    return { ok: false, error: "Something went wrong while saving. Please try again." };
  }
}

function isUniqueViolation(e: unknown) {
  return typeof e === "object" && e !== null && "code" in e && String((e as { code: unknown }).code).startsWith("SQLITE_CONSTRAINT_UNIQUE");
}

function isDigestError(e: unknown) {
  return typeof e === "object" && e !== null && "digest" in e && typeof (e as { digest: unknown }).digest === "string" && (e as { digest: string }).digest.startsWith("NEXT_");
}

/** Converts FormData into a plain object; repeated keys become arrays; `[]`-suffixed keys always arrays. */
export function formToObject(fd: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [rawKey, value] of fd.entries()) {
    if (rawKey.startsWith("$ACTION")) continue;
    const isArr = rawKey.endsWith("[]");
    const key = isArr ? rawKey.slice(0, -2) : rawKey;
    const v = typeof value === "string" ? value : value;
    if (isArr) ((out[key] ??= []) as unknown[]).push(v);
    else if (key in out) out[key] = ([] as unknown[]).concat(out[key], v);
    else out[key] = v;
  }
  return out;
}

export function parseJsonField<T>(fd: FormData, key: string): T | undefined {
  const raw = fd.get(key);
  if (typeof raw !== "string" || raw === "") return undefined;
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new UserError("Malformed form data.");
  }
}
