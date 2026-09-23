"use server";

import { redirect } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { db, schema as s } from "@/db";
import type { ActionResult } from "@/lib/action-types";
import { loginSchema } from "@/lib/validation";
import { clearLoginFailures, createSession, destroySession, getAuth, isLoginLocked, recordLoginFailure, verifyPassword } from "../auth";
import { headers } from "next/headers";

// Constant-time-ish guard: compare against a dummy hash when the user doesn't exist.
const DUMMY_HASH = "$2b$12$4JLZ.i2h.4GK4ttT3srj8uicewnje2eKojPsSKKoUh80xh6p/3jbO";

export async function signIn(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const parsed = loginSchema.safeParse({ email: fd.get("email"), password: fd.get("password") });
  if (!parsed.success) return { ok: false, error: "Enter a valid email and password." };
  const { email, password } = parsed.data;
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const key = `${email}|${ip}`;
  if (isLoginLocked(key)) return { ok: false, error: "Too many attempts. Please wait a few minutes and try again." };

  const user = db.select().from(s.users).where(eq(s.users.email, email)).get();
  const valid = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !valid || !user.active) {
    recordLoginFailure(key);
    return { ok: false, error: "Incorrect email or password." };
  }
  clearLoginFailures(key);
  db.update(s.users).set({ lastLoginAt: new Date().toISOString() }).where(eq(s.users.id, user.id)).run();
  await createSession(user.id);
  const next = String(fd.get("next") ?? "");
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : null;
  redirect(user.role === "Client" ? "/portal" : (safeNext ?? "/dashboard"));
}

export async function signOut() {
  await destroySession();
  redirect("/login");
}

export async function markNotificationRead(id: string) {
  const auth = await getAuth();
  if (!auth) return;
  db.update(s.notifications)
    .set({ readAt: new Date().toISOString() })
    .where(and(eq(s.notifications.id, id), eq(s.notifications.userId, auth.user.id)))
    .run();
}

export async function markAllNotificationsRead() {
  const auth = await getAuth();
  if (!auth) return;
  db.update(s.notifications)
    .set({ readAt: new Date().toISOString() })
    .where(and(eq(s.notifications.userId, auth.user.id), isNull(s.notifications.readAt)))
    .run();
}
