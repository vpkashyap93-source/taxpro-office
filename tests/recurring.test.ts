import { describe, expect, it } from "vitest";
import { duePeriods, intervalFor, periodKey, periodKeyLabel } from "@/lib/recurring";
import { addMonths, financialYearOf, relativeDue } from "@/lib/dates";

describe("recurring billing periods", () => {
  it("maps frequency to interval", () => {
    expect(intervalFor("Monthly")).toBe(1);
    expect(intervalFor("Quarterly")).toBe(3);
    expect(intervalFor("Yearly")).toBe(12);
    expect(intervalFor("Custom", 2)).toBe(2);
    expect(intervalFor("Custom", 99)).toBe(24);
  });

  it("lists every unbilled period up to the chosen month", () => {
    expect(duePeriods("2026-07-01", 1, "2026-09").map((p) => p.key)).toEqual(["2026-07", "2026-08", "2026-09"]);
    expect(duePeriods("2026-10-01", 1, "2026-09")).toEqual([]);
    const q = duePeriods("2026-07-01", 3, "2026-12");
    expect(q.map((p) => p.key)).toEqual(["2026-07..2026-09", "2026-10..2026-12"]);
  });

  it("builds stable period keys for duplicate protection", () => {
    expect(periodKey("2026-09-01", 1)).toBe("2026-09");
    expect(periodKeyLabel("2026-09")).toBe("Sept 2026".replace("Sept", new Intl.DateTimeFormat("en-IN", { month: "short", timeZone: "UTC" }).format(new Date(Date.UTC(2026, 8, 1)))));
  });
});

describe("dates", () => {
  it("handles Indian financial years and month arithmetic", () => {
    expect(financialYearOf("2026-03-31")).toBe("2025-26");
    expect(financialYearOf("2026-04-01")).toBe("2026-27");
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(relativeDue("2026-09-23", "2026-09-23")).toBe("Today");
    expect(relativeDue("2026-09-20", "2026-09-23")).toBe("3 days overdue");
  });
});
