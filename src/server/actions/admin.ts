"use server";

import { and, eq, ne, sql } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { db, schema as s } from "@/db";
import { COMPLIANCE_CATEGORIES } from "@/db/schema";
import type { ActionResult } from "@/lib/action-types";
import { ACCESS_LEVELS, MODULES, STAFF_ROLES, mergePermissions, type PermissionMatrix } from "@/lib/permissions";
import { firmSchema, passwordRule, userSchema } from "@/lib/validation";
import { authorize, getAuth, hashPassword, verifyPassword, AuthError } from "../auth";
import { formToObject, runAction, UserError } from "../action";
import { audit, logActivity, touched } from "../activity";
import { setSetting } from "../settings";

async function requireAdmin(module: "team" | "settings" | "portal") {
  const auth = await authorize(module, "edit");
  return auth;
}

function activeAdmins(firmId: string, exceptId?: string) {
  return db
    .select({ n: sql<number>`count(*)` })
    .from(s.users)
    .where(and(eq(s.users.firmId, firmId), eq(s.users.role, "Admin"), eq(s.users.active, true), exceptId ? ne(s.users.id, exceptId) : sql`1=1`))
    .get()?.n ?? 0;
}

/** Generates a readable temporary password that satisfies the password policy. */
function tempPassword() {
  return `Tp-${randomBytes(6).toString("base64url")}${Math.floor(Math.random() * 90 + 10)}`;
}

/* ------------------------------------------------------------------ team */

export async function saveUser(id: string | null, _: ActionResult<{ tempPassword?: string }>, fd: FormData): Promise<ActionResult<{ tempPassword?: string }>> {
  return runAction(async () => {
    const auth = await requireAdmin("team");
    const raw = formToObject(fd);
    const data = userSchema.parse({ ...raw, active: raw.active === "on" });
    const dupe = db.select({ id: s.users.id }).from(s.users).where(eq(s.users.email, data.email)).get();
    if (dupe && dupe.id !== id) throw new UserError("Another user already uses this email.");
    if (id) {
      const u = db.select().from(s.users).where(and(eq(s.users.id, id), eq(s.users.firmId, auth.firm.id))).get();
      if (!u || u.role === "Client") throw new UserError("Team member not found.");
      const losingAdmin = u.role === "Admin" && (data.role !== "Admin" || !data.active);
      if (losingAdmin && activeAdmins(auth.firm.id, id) === 0) throw new UserError("The firm must keep at least one active Admin.");
      if (id === auth.user.id && !data.active) throw new UserError("You cannot deactivate your own account.");
      db.update(s.users)
        .set({ name: data.name, email: data.email, phone: data.phone ?? null, role: data.role, designation: data.designation ?? null, active: data.active, ...(data.password ? { passwordHash: await hashPassword(data.password) } : {}), ...touched(auth) })
        .where(eq(s.users.id, id))
        .run();
      if (!data.active || data.password) db.delete(s.sessions).where(eq(s.sessions.userId, id)).run();
      logActivity(auth, { entityType: "user", entityId: id, action: "updated", summary: `Team member ${data.name} updated (${data.role}${data.active ? "" : ", inactive"})` });
      return { ok: true, message: "Team member updated" };
    }
    const password = data.password ?? tempPassword();
    const newId = db
      .insert(s.users)
      .values({ firmId: auth.firm.id, name: data.name, email: data.email, phone: data.phone ?? null, role: data.role, designation: data.designation ?? null, active: data.active, passwordHash: await hashPassword(password), ...audit(auth) })
      .returning({ id: s.users.id })
      .get().id;
    logActivity(auth, { entityType: "user", entityId: newId, action: "created", summary: `Team member ${data.name} added as ${data.role}` });
    return { ok: true, message: `${data.name} added`, data: data.password ? {} : { tempPassword: password } };
  });
}

export async function savePermissions(matrix: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const auth = await requireAdmin("team");
    if (auth.user.role !== "Admin") throw new AuthError("Only an Admin can change permissions.");
    const level = z.enum(ACCESS_LEVELS);
    const roleShape = z.object(Object.fromEntries(MODULES.map((m) => [m, level])) as Record<(typeof MODULES)[number], typeof level>);
    const parsed = z.object(Object.fromEntries(STAFF_ROLES.map((r) => [r, roleShape])) as Record<(typeof STAFF_ROLES)[number], typeof roleShape>).parse(matrix);
    const merged = mergePermissions(parsed as PermissionMatrix); // enforces Admin lock on team/settings
    setSetting(auth.firm.id, "permissions", merged, auth.user.id);
    logActivity(auth, { entityType: "settings", action: "permissions", summary: "Role permissions updated" });
    return { ok: true, message: "Permissions saved" };
  });
}

/* ------------------------------------------------------------------ settings */

export async function saveFirm(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const auth = await requireAdmin("settings");
    const d = firmSchema.parse(formToObject(fd));
    db.update(s.firms).set({ name: d.name, legalName: d.legalName ?? null, gstin: d.gstin ?? null, pan: d.pan ?? null, email: d.email ?? null, phone: d.phone ?? null, address: d.address ?? null, state: d.state ?? null, ...touched(auth) }).where(eq(s.firms.id, auth.firm.id)).run();
    logActivity(auth, { entityType: "settings", action: "firm", summary: "Firm profile updated" });
    return { ok: true, message: "Firm profile saved" };
  });
}

const invoiceSettingsSchema = z.object({
  prefix: z.string().trim().regex(/^[A-Z0-9-]{1,10}$/i, "Use 1–10 letters, digits or hyphens").transform((v) => v.toUpperCase()),
  defaultDueDays: z.coerce.number().int().min(0).max(120),
  defaultGstRate: z.coerce.number().int().min(0).max(28),
  sac: z.string().trim().regex(/^\d{4,8}$/, "SAC must be 4–8 digits"),
  terms: z.string().trim().max(600),
});
const bankSchema = z.object({
  accountName: z.string().trim().max(120),
  bankName: z.string().trim().max(120),
  accountNumber: z.string().trim().regex(/^\d{6,20}$/, "Account number must be 6–20 digits").or(z.literal("")),
  ifsc: z.string().trim().toUpperCase().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, "IFSC format: ABCD0123456").or(z.literal("")),
  upiId: z.string().trim().regex(/^[\w.\-]{2,}@[a-zA-Z]{2,}$/, "UPI format: name@bank").or(z.literal("")),
});

export async function saveBilling(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const auth = await requireAdmin("settings");
    const raw = formToObject(fd);
    const inv = invoiceSettingsSchema.parse(raw);
    const bank = bankSchema.parse(raw);
    setSetting(auth.firm.id, "invoice", inv, auth.user.id);
    setSetting(auth.firm.id, "bank", bank, auth.user.id);
    logActivity(auth, { entityType: "settings", action: "billing", summary: "Invoice & bank settings updated" });
    return { ok: true, message: "Billing settings saved" };
  });
}

const typeSchema = z.object({
  category: z.enum(COMPLIANCE_CATEGORIES),
  name: z.string().trim().min(2).max(60),
  periodicity: z.enum(["Monthly", "Quarterly", "Yearly", "One-time"]),
  defaultDueDay: z.preprocess((v) => (v === "" || v === null ? null : v), z.coerce.number().int().min(1).max(31).nullable()),
});

export async function saveComplianceType(id: string | null, _: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const auth = await requireAdmin("settings");
    const d = typeSchema.parse(formToObject(fd));
    if (id) {
      const t = db.select({ id: s.complianceTypes.id }).from(s.complianceTypes).where(and(eq(s.complianceTypes.id, id), eq(s.complianceTypes.firmId, auth.firm.id))).get();
      if (!t) throw new UserError("Compliance type not found.");
      db.update(s.complianceTypes).set({ ...d, ...touched(auth) }).where(eq(s.complianceTypes.id, id)).run();
    } else {
      db.insert(s.complianceTypes).values({ ...d, firmId: auth.firm.id, ...audit(auth) }).run();
    }
    return { ok: true, message: "Compliance type saved" };
  });
}

export async function toggleComplianceType(id: string, active: boolean): Promise<ActionResult> {
  return runAction(async () => {
    const auth = await requireAdmin("settings");
    db.update(s.complianceTypes).set({ active, ...touched(auth) }).where(and(eq(s.complianceTypes.id, id), eq(s.complianceTypes.firmId, auth.firm.id))).run();
    return { ok: true, message: active ? "Type enabled" : "Type disabled" };
  });
}

/* ------------------------------------------------------------------ my account */

export async function changeMyPassword(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const auth = await getAuth();
    if (!auth) throw new AuthError("You are not signed in.");
    const d = z
      .object({ current: z.string().min(1, "Enter your current password"), next: passwordRule, confirm: z.string() })
      .refine((v) => v.next === v.confirm, { path: ["confirm"], message: "Passwords do not match" })
      .parse(formToObject(fd));
    const u = db.select().from(s.users).where(eq(s.users.id, auth.user.id)).get()!;
    if (!(await verifyPassword(d.current, u.passwordHash))) throw new UserError("Current password is incorrect.");
    db.update(s.users).set({ passwordHash: await hashPassword(d.next), updatedBy: u.id, updatedAt: new Date().toISOString() }).where(eq(s.users.id, u.id)).run();
    logActivity(auth, { entityType: "user", entityId: u.id, action: "password", summary: `${u.name} changed their password` });
    return { ok: true, message: "Password changed" };
  });
}

/* ------------------------------------------------------------------ client portal access */

export async function enablePortalAccess(clientId: string, email: string): Promise<ActionResult<{ tempPassword: string; email: string }>> {
  return runAction(async () => {
    const auth = await requireAdmin("portal");
    const e = z.string().trim().toLowerCase().email("Enter a valid email").parse(email);
    const client = db.select().from(s.clients).where(and(eq(s.clients.id, clientId), eq(s.clients.firmId, auth.firm.id))).get();
    if (!client) throw new UserError("Client not found.");
    const existing = db.select().from(s.users).where(and(eq(s.users.clientId, clientId), eq(s.users.role, "Client"))).get();
    const dupe = db.select({ id: s.users.id }).from(s.users).where(eq(s.users.email, e)).get();
    if (dupe && dupe.id !== existing?.id) throw new UserError("This email is already used by another login.");
    const password = tempPassword();
    const hash = await hashPassword(password);
    if (existing) {
      db.update(s.users).set({ email: e, passwordHash: hash, active: true, ...touched(auth) }).where(eq(s.users.id, existing.id)).run();
      db.delete(s.sessions).where(eq(s.sessions.userId, existing.id)).run();
    } else {
      db.insert(s.users).values({ firmId: auth.firm.id, name: client.name, email: e, passwordHash: hash, role: "Client", clientId, ...audit(auth) }).run();
    }
    logActivity(auth, { clientId, entityType: "portal", action: "enabled", summary: `Client portal access ${existing ? "reset" : "enabled"} for ${e}` });
    return { ok: true, message: "Portal access ready", data: { tempPassword: password, email: e } };
  });
}

export async function disablePortalAccess(clientId: string): Promise<ActionResult> {
  return runAction(async () => {
    const auth = await requireAdmin("portal");
    const u = db.select().from(s.users).where(and(eq(s.users.clientId, clientId), eq(s.users.role, "Client"), eq(s.users.firmId, auth.firm.id))).get();
    if (!u) throw new UserError("Portal access is not enabled for this client.");
    db.update(s.users).set({ active: false, ...touched(auth) }).where(eq(s.users.id, u.id)).run();
    db.delete(s.sessions).where(eq(s.sessions.userId, u.id)).run();
    logActivity(auth, { clientId, entityType: "portal", action: "disabled", summary: "Client portal access disabled" });
    return { ok: true, message: "Portal access disabled" };
  });
}
