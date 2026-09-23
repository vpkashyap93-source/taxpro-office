/** Money helpers. All amounts are stored as integer paise. */

const inr = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
const inr2 = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** ₹4,25,000 (Indian digit grouping). */
export function formatINR(paise: number, opts: { decimals?: boolean } = {}): string {
  const rupees = paise / 100;
  const sign = rupees < 0 ? "-" : "";
  const body = (opts.decimals ? inr2 : inr).format(Math.abs(rupees));
  return `${sign}₹${body}`;
}

/** Compact: ₹4.25L, ₹1.2Cr, ₹67.5K */
export function formatINRCompact(paise: number): string {
  const r = paise / 100;
  const abs = Math.abs(r);
  const trim = (n: number) => n.toFixed(2).replace(/\.?0+$/, "");
  if (abs >= 1e7) return `₹${trim(r / 1e7)}Cr`;
  if (abs >= 1e5) return `₹${trim(r / 1e5)}L`;
  if (abs >= 1e3) return `₹${trim(r / 1e3)}K`;
  return `₹${Math.round(r)}`;
}

export const toPaise = (rupees: number) => Math.round(rupees * 100);
export const toRupees = (paise: number) => paise / 100;

/** Parse user input like "4,500.50" or "₹ 4500" into paise; returns NaN if invalid. */
export function parseRupeesToPaise(input: unknown): number {
  if (typeof input === "number") return toPaise(input);
  if (typeof input !== "string") return NaN;
  const cleaned = input.replace(/[₹,\s]/g, "");
  if (cleaned === "") return NaN;
  const n = Number(cleaned);
  return Number.isFinite(n) ? toPaise(n) : NaN;
}

export interface InvoiceTotals {
  subtotal: number;
  discount: number;
  taxable: number;
  gstAmount: number;
  total: number;
}

/** GST is applied on (subtotal − discount). Rounded to the nearest rupee on the grand total. */
export function computeInvoiceTotals(itemAmounts: number[], discount: number, gstRate: number): InvoiceTotals {
  const subtotal = itemAmounts.reduce((a, b) => a + b, 0);
  const safeDiscount = Math.min(Math.max(discount, 0), subtotal);
  const taxable = subtotal - safeDiscount;
  const gstAmount = Math.round((taxable * gstRate) / 100);
  const total = Math.round((taxable + gstAmount) / 100) * 100;
  return { subtotal, discount: safeDiscount, taxable, gstAmount, total };
}

/** Indian-English amount in words, e.g. "Five Thousand Nine Hundred Rupees Only". */
export function amountInWords(paise: number): string {
  const rupees = Math.floor(paise / 100);
  const p = Math.round(paise % 100);
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const two = (n: number) => (n < 20 ? ones[n] : `${tens[Math.floor(n / 10)]}${n % 10 ? " " + ones[n % 10] : ""}`);
  const three = (n: number) => {
    const h = Math.floor(n / 100);
    const r = n % 100;
    return [h ? `${ones[h]} Hundred` : "", r ? two(r) : ""].filter(Boolean).join(" ");
  };
  if (rupees === 0 && p === 0) return "Zero Rupees Only";
  const parts: string[] = [];
  let n = rupees;
  const crore = Math.floor(n / 1e7); n %= 1e7;
  const lakh = Math.floor(n / 1e5); n %= 1e5;
  const thousand = Math.floor(n / 1e3); n %= 1e3;
  if (crore) parts.push(`${three(crore)} Crore`);
  if (lakh) parts.push(`${two(lakh)} Lakh`);
  if (thousand) parts.push(`${two(thousand)} Thousand`);
  if (n) parts.push(three(n));
  let words = parts.join(" ");
  words = words ? `${words} Rupees` : "";
  if (p) words += `${words ? " and " : ""}${two(p)} Paise`;
  return `${words} Only`;
}
