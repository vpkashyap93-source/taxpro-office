import { describe, expect, it } from "vitest";
import { buildGstin, isValidGstin } from "@/lib/identifiers";
import { can, DEFAULT_PERMISSIONS, mergePermissions } from "@/lib/permissions";
import { clientSchema } from "@/lib/validation";

describe("GSTIN", () => {
  it("validates the check character", () => {
    const g = buildGstin("03", "AAKFA3121K");
    expect(isValidGstin(g)).toBe(true);
    const tampered = g.slice(0, 14) + (g[14] === "A" ? "B" : "A");
    expect(isValidGstin(tampered)).toBe(false);
    expect(isValidGstin("27AAPFU0939F1ZV")).toBe(true); // well-known valid sample
  });

  it("rejects a GSTIN that doesn't embed the client's PAN", () => {
    const r = clientSchema.safeParse({ name: "Test", status: "Active", pan: "AAKFA3121K", gstin: buildGstin("03", "AAPFS7612Q") });
    expect(r.success).toBe(false);
  });
});

describe("permissions", () => {
  it("keeps juniors out of sensitive financial areas by default", () => {
    expect(can(DEFAULT_PERMISSIONS, "Junior", "billing")).toBe(false);
    expect(can(DEFAULT_PERMISSIONS, "Junior", "settings")).toBe(false);
    expect(can(DEFAULT_PERMISSIONS, "Junior", "compliance", "edit")).toBe(true);
    expect(can(DEFAULT_PERMISSIONS, "Billing Staff", "payments", "edit")).toBe(true);
    expect(can(DEFAULT_PERMISSIONS, "Client", "dashboard")).toBe(false);
  });

  it("never lets a saved matrix lock the Admin out of Team or Settings", () => {
    const m = mergePermissions({ Admin: { ...DEFAULT_PERMISSIONS.Admin, team: "none", settings: "view" } });
    expect(m.Admin.team).toBe("edit");
    expect(m.Admin.settings).toBe("edit");
  });
});
