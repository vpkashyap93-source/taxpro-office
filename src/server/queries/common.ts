import "server-only";
import { and, asc, eq, ne } from "drizzle-orm";
import { db, schema as s } from "@/db";

export interface Option {
  value: string;
  label: string;
}

export function staffOptions(firmId: string): Option[] {
  return db
    .select({ value: s.users.id, label: s.users.name })
    .from(s.users)
    .where(and(eq(s.users.firmId, firmId), ne(s.users.role, "Client"), eq(s.users.active, true)))
    .orderBy(asc(s.users.name))
    .all();
}

export function clientOptions(firmId: string, opts: { includeInactive?: boolean } = {}): Option[] {
  const rows = db
    .select({ value: s.clients.id, label: s.clients.name, status: s.clients.status, code: s.clients.code })
    .from(s.clients)
    .where(eq(s.clients.firmId, firmId))
    .orderBy(asc(s.clients.name))
    .all();
  return rows.filter((r) => opts.includeInactive || r.status !== "Inactive").map((r) => ({ value: r.value, label: r.label }));
}

export function staffNameMap(firmId: string): Map<string, string> {
  return new Map(
    db.select({ id: s.users.id, name: s.users.name }).from(s.users).where(eq(s.users.firmId, firmId)).all().map((u) => [u.id, u.name]),
  );
}

export function complianceTypeOptions(firmId: string) {
  return db
    .select({ category: s.complianceTypes.category, name: s.complianceTypes.name, defaultDueDay: s.complianceTypes.defaultDueDay, periodicity: s.complianceTypes.periodicity })
    .from(s.complianceTypes)
    .where(and(eq(s.complianceTypes.firmId, firmId), eq(s.complianceTypes.active, true)))
    .orderBy(asc(s.complianceTypes.category), asc(s.complianceTypes.name))
    .all();
}
