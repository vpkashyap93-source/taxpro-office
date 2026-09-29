import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createHmac, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { and, eq, gt } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Role } from "@/db/schema";
import { can, mergePermissions, type Module, type PermissionMatrix } from "@/lib/permissions";
import { getSetting } from "./settings";

export const SESSION_COOKIE = "tpo_session";

function sessionSecret(): string {
  const s = process.env.SESSION_SECRET;
  if (s && s.length >= 16) return s;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET must be set (>= 16 chars) in production.");
  }
  const g = globalThis as unknown as { __tpoDevSecret?: string };
  g.__tpoDevSecret ??= randomBytes(32).toString("hex");
  return g.__tpoDevSecret;
}

const ttlHours = () => Math.max(1, Number(process.env.SESSION_TTL_HOURS ?? 12));

/** Session ids in the DB are HMACs of the cookie token, so a leaked DB cannot be replayed as cookies. */
const hashToken = (token: string) => createHmac("sha256", sessionSecret()).update(token).digest("hex");

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + ttlHours() * 3_600_000);
  const ua = (await headers()).get("user-agent")?.slice(0, 250) ?? null;
  db.insert(schema.sessions)
    .values({ id: hashToken(token), userId, expiresAt: expires.toISOString(), userAgent: ua })
    .run();
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    // COOKIE_SECURE=false only for trusted LAN testing over plain http (e.g. opening the app on a phone).
    secure: process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === "true" : process.env.NODE_ENV === "production",
    path: "/",
    expires,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) db.delete(schema.sessions).where(eq(schema.sessions.id, hashToken(token))).run();
  jar.delete(SESSION_COOKIE);
}

export interface SessionUser {
  id: string;
  firmId: string;
  name: string;
  email: string;
  role: Role;
  designation: string | null;
  clientId: string | null;
}

export interface AuthContext {
  user: SessionUser;
  firm: { id: string; name: string; state: string | null };
  permissions: PermissionMatrix;
  can: (module: Module, need?: "view" | "edit") => boolean;
}

/** Resolves the current session (memoised per request). Returns null when signed out/expired. */
export const getAuth = cache(async (): Promise<AuthContext | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const row = db
    .select({ user: schema.users, firm: schema.firms })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
    .innerJoin(schema.firms, eq(schema.firms.id, schema.users.firmId))
    .where(and(eq(schema.sessions.id, hashToken(token)), gt(schema.sessions.expiresAt, new Date().toISOString())))
    .get();
  if (!row || !row.user.active) return null;
  const { user, firm } = row;
  const permissions = mergePermissions(getSetting<Partial<PermissionMatrix>>(firm.id, "permissions"));
  return {
    user: {
      id: user.id,
      firmId: user.firmId,
      name: user.name,
      email: user.email,
      role: user.role,
      designation: user.designation,
      clientId: user.clientId,
    },
    firm: { id: firm.id, name: firm.name, state: firm.state },
    permissions,
    can: (module, need = "view") => can(permissions, user.role, module, need),
  };
});

/** For pages: redirect to login when signed out; to the portal for client users. */
export async function requireStaff(module?: Module, need: "view" | "edit" = "view"): Promise<AuthContext> {
  const auth = await getAuth();
  if (!auth) redirect("/login");
  if (auth.user.role === "Client") redirect("/portal");
  if (module && !auth.can(module, need)) redirect(`/forbidden?module=${module}`);
  return auth;
}

export async function requireClientUser(): Promise<AuthContext & { user: SessionUser & { clientId: string } }> {
  const auth = await getAuth();
  if (!auth) redirect("/login");
  if (auth.user.role !== "Client" || !auth.user.clientId) redirect("/dashboard");
  return auth as AuthContext & { user: SessionUser & { clientId: string } };
}

export class AuthError extends Error {}

/** For server actions / route handlers: throws instead of redirecting. */
export async function authorize(module: Module, need: "view" | "edit" = "edit"): Promise<AuthContext> {
  const auth = await getAuth();
  if (!auth || auth.user.role === "Client") throw new AuthError("You are not signed in.");
  if (!auth.can(module, need)) throw new AuthError("You do not have permission to perform this action.");
  return auth;
}

/* ---------------------------------------------------------- login throttling (in-memory, per process) */

const attempts = new Map<string, { count: number; until: number }>();
const MAX_ATTEMPTS = 5;
const LOCK_MS = 5 * 60_000;

export function isLoginLocked(key: string) {
  const a = attempts.get(key);
  return !!a && a.count >= MAX_ATTEMPTS && a.until > Date.now();
}

export function recordLoginFailure(key: string) {
  const a = attempts.get(key);
  const fresh = !a || a.until < Date.now();
  attempts.set(key, { count: fresh ? 1 : a.count + 1, until: Date.now() + LOCK_MS });
}

export function clearLoginFailures(key: string) {
  attempts.delete(key);
}
