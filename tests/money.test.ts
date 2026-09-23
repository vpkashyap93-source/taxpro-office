import { describe, expect, it } from "vitest";
import { amountInWords, computeInvoiceTotals, formatINR, formatINRCompact, parseRupeesToPaise } from "@/lib/money";

describe("money", () => {
  it("formats with Indian digit grouping", () => {
    expect(formatINR(42500000)).toBe("₹4,25,000");
    expect(formatINR(590000)).toBe("₹5,900");
    expect(formatINR(-150)).toBe("-₹2");
    expect(formatINRCompact(42500000)).toBe("₹4.25L");
    expect(formatINRCompact(1_20_00_000_00)).toBe("₹1.2Cr");
  });

  it("parses user input to paise", () => {
    expect(parseRupeesToPaise("4,500.50")).toBe(450050);
    expect(parseRupeesToPaise("₹ 3000")).toBe(300000);
    expect(Number.isNaN(parseRupeesToPaise("abc"))).toBe(true);
    expect(Number.isNaN(parseRupeesToPaise(""))).toBe(true);
  });

  it("computes GST on (subtotal − discount) and rounds the total to a rupee", () => {
    // Example from the brief: ₹5,000 + 18% GST = ₹5,900
    expect(computeInvoiceTotals([500000], 0, 18)).toEqual({ subtotal: 500000, discount: 0, taxable: 500000, gstAmount: 90000, total: 590000 });
    const t = computeInvoiceTotals([300000, 100000, 50000], 25000, 18);
    expect(t.taxable).toBe(425000);
    expect(t.gstAmount).toBe(76500);
    expect(t.total).toBe(501500);
    // discount can't exceed subtotal
    expect(computeInvoiceTotals([10000], 99999, 18).total).toBe(0);
    // rounding to nearest rupee
    expect(computeInvoiceTotals([33333], 0, 18).total % 100).toBe(0);
  });

  it("writes amounts in Indian words", () => {
    expect(amountInWords(590000)).toBe("Five Thousand Nine Hundred Rupees Only");
    expect(amountInWords(42500000)).toBe("Four Lakh Twenty Five Thousand Rupees Only");
    expect(amountInWords(12345678950)).toBe("Twelve Crore Thirty Four Lakh Fifty Six Thousand Seven Hundred Eighty Nine Rupees and Fifty Paise Only");
  });
});
