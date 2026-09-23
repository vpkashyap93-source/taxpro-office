import "server-only";
import { db, schema } from "@/db";
import type { AuthContext } from "./auth";

export function logActivity(
  auth: AuthContext,
  entry: { clientId?: string | null; entityType: string; entityId?: string | null; action: string; summary: string },
) {
  db.insert(schema.activityLogs)
    .values({ firmId: auth.firm.id, userId: auth.user.id, clientId: entry.clientId ?? null, entityType: entry.entityType, entityId: entry.entityId ?? null, action: entry.action, summary: entry.summary })
    .run();
}

export function notify(
  auth: AuthContext,
  userId: string | null | undefined,
  n: { kind: string; title: string; body?: string; href?: string; dedupeKey?: string },
) {
  if (!userId || userId === auth.user.id) return;
  db.insert(schema.notifications)
    .values({ firmId: auth.firm.id, userId, ...n })
    .onConflictDoNothing()
    .run();
}

export const audit = (auth: AuthContext) => ({ createdBy: auth.user.id, updatedBy: auth.user.id });
export const touched = (auth: AuthContext) => ({ updatedBy: auth.user.id, updatedAt: new Date().toISOString() });
