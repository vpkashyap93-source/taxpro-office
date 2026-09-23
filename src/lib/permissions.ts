/**
 * Role-based access control. Pure module (safe on client & server).
 * The effective matrix is the firm's saved matrix (settings key "permissions") merged over these defaults.
 */
import type { Role } from "@/db/schema";

export const MODULES = [
  "dashboard",
  "clients",
  "billing",
  "payments",
  "compliance",
  "documents",
  "cma",
  "tasks",
  "calendar",
  "notices",
  "dsc",
  "reports",
  "team",
  "portal",
  "settings",
] as const;
export type Module = (typeof MODULES)[number];

export const MODULE_LABELS: Record<Module, string> = {
  dashboard: "Dashboard",
  clients: "Clients",
  billing: "Billing & Invoices",
  payments: "Payments",
  compliance: "Compliance",
  documents: "Documents",
  cma: "CMA",
  tasks: "Tasks",
  calendar: "Calendar",
  notices: "Notices",
  dsc: "DSC Tracker",
  reports: "Reports",
  team: "Team Management",
  portal: "Client Portal",
  settings: "Settings",
};

export const ACCESS_LEVELS = ["none", "view", "edit"] as const;
export type Access = (typeof ACCESS_LEVELS)[number];
export type PermissionMatrix = Record<Exclude<Role, "Client">, Record<Module, Access>>;
export type StaffRole = Exclude<Role, "Client">;
export const STAFF_ROLES: StaffRole[] = ["Admin", "Senior", "Junior", "Billing Staff"];

/** Modules whose access is never configurable below "edit" for Admin (prevents lock-out). */
export const ADMIN_LOCKED: Module[] = ["team", "settings"];

const all = (level: Access) => Object.fromEntries(MODULES.map((m) => [m, level])) as Record<Module, Access>;

export const DEFAULT_PERMISSIONS: PermissionMatrix = {
  Admin: all("edit"),
  Senior: {
    ...all("edit"),
    billing: "view",
    payments: "view",
    reports: "view",
    team: "view",
    portal: "view",
    settings: "none",
  },
  Junior: {
    ...all("none"),
    dashboard: "view",
    clients: "view",
    compliance: "edit",
    documents: "edit",
    cma: "edit",
    tasks: "edit",
    calendar: "view",
    notices: "view",
    dsc: "view",
  },
  "Billing Staff": {
    ...all("none"),
    dashboard: "view",
    clients: "view",
    billing: "edit",
    payments: "edit",
    reports: "view",
    tasks: "edit",
    calendar: "view",
    portal: "view",
  },
};

export function mergePermissions(saved: Partial<PermissionMatrix> | null | undefined): PermissionMatrix {
  const out = structuredClone(DEFAULT_PERMISSIONS);
  if (!saved) return out;
  for (const role of STAFF_ROLES) {
    const r = saved[role];
    if (!r) continue;
    for (const m of MODULES) {
      const v = r[m];
      if (v && (ACCESS_LEVELS as readonly string[]).includes(v)) out[role][m] = v;
    }
  }
  for (const m of ADMIN_LOCKED) out.Admin[m] = "edit";
  return out;
}

export function can(matrix: PermissionMatrix, role: Role, module: Module, need: "view" | "edit" = "view"): boolean {
  if (role === "Client") return false;
  const level = matrix[role][module];
  return need === "view" ? level === "view" || level === "edit" : level === "edit";
}
