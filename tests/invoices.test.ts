import { describe, expect, it } from "vitest";
import { effectiveInvoiceStatus, formatInvoiceNumber, outstandingOf, validatePaymentAmount } from "@/lib/invoices";

const base = { total: 590000, dueDate: "2026-09-30" };

describe("invoice status", () => {
  it("derives Paid / Partially Paid / Overdue from payments and due date", () => {
    expect(effectiveInvoiceStatus({ ...base, status: "Sent", paid: 590000 }, "2026-10-10")).toBe("Paid");
    expect(effectiveInvoiceStatus({ ...base, status: "Sent", paid: 300000 }, "2026-09-20")).toBe("Partially Paid");
    expect(effectiveInvoiceStatus({ ...base, status: "Sent", paid: 300000 }, "2026-10-01")).toBe("Overdue");
    expect(effectiveInvoiceStatus({ ...base, status: "Generated", paid: 0 }, "2026-09-20")).toBe("Generated");
    expect(effectiveInvoiceStatus({ ...base, status: "Sent", paid: 0 }, "2026-09-30")).toBe("Sent");
  });

  it("keeps Draft and Cancelled as terminal states with no outstanding", () => {
    expect(effectiveInvoiceStatus({ ...base, status: "Draft", paid: 0 }, "2027-01-01")).toBe("Draft");
    expect(outstandingOf({ status: "Cancelled", total: 590000, paid: 0 })).toBe(0);
    expect(outstandingOf({ status: "Sent", total: 590000, paid: 300000 })).toBe(290000);
  });

  it("supports partial payments but blocks overpayment", () => {
    // Invoice = ₹5,900, Paid = ₹3,000, Outstanding = ₹2,900 (from the brief)
    const inv = { total: 590000, paid: 300000, status: "Sent" as const };
    expect(validatePaymentAmount(290000, inv)).toBeNull();
    expect(validatePaymentAmount(290100, inv)).toMatch(/exceeds/);
    expect(validatePaymentAmount(0, inv)).toMatch(/greater than zero/);
    expect(validatePaymentAmount(1000, { ...inv, status: "Draft" })).toMatch(/Finalise/);
    expect(validatePaymentAmount(1000, null)).toBeNull(); // on-account receipt
  });

  it("formats sequential invoice numbers per FY", () => {
    expect(formatInvoiceNumber("TPO", "2026-27", 7)).toBe("TPO/2026-27/0007");
  });
});
