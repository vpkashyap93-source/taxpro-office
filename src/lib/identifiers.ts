/** Indian tax identifier format checks (format-level only; no government lookup). */

export const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
export const TAN_RE = /^[A-Z]{4}[0-9]{5}[A-Z]$/;
export const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
export const UDYAM_RE = /^UDYAM-[A-Z]{2}-[0-9]{2}-[0-9]{7}$/;
export const MOBILE_RE = /^[6-9][0-9]{9}$/;

const GST_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** GSTIN check character (mod-36 weighted checksum over the first 14 characters). */
export function gstinCheckChar(first14: string): string {
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const v = GST_CHARS.indexOf(first14[i]!);
    const product = v * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(product / 36) + (product % 36);
  }
  return GST_CHARS[(36 - (sum % 36)) % 36]!;
}

export function isValidGstin(gstin: string): boolean {
  if (!GSTIN_RE.test(gstin)) return false;
  return gstinCheckChar(gstin.slice(0, 14)) === gstin[14];
}

export function buildGstin(stateCode: string, pan: string, entity = "1"): string {
  const first14 = `${stateCode}${pan}${entity}Z`;
  return first14 + gstinCheckChar(first14);
}

/** GSTIN must embed the client's PAN (chars 3–12) when both are provided. */
export function gstinMatchesPan(gstin: string, pan: string): boolean {
  return gstin.slice(2, 12) === pan;
}

export const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", "Haryana",
  "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur",
  "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana",
  "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal", "Andaman and Nicobar Islands", "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry",
] as const;

export const CONSTITUTIONS = [
  "Individual",
  "Proprietorship",
  "Partnership Firm",
  "LLP",
  "Private Limited Company",
  "Public Limited Company",
  "HUF",
  "Trust / Society",
  "Other",
] as const;

export const BUSINESS_TYPES = [
  "Trading",
  "Manufacturing",
  "Services",
  "Retail",
  "Wholesale",
  "Professional",
  "Salaried",
  "Contractor",
  "Agriculture",
  "Other",
] as const;
