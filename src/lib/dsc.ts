import { diffDays } from "./dates";

export type DscBucket = "Expired" | "7 days" | "15 days" | "30 days" | "Valid";

export function dscBucket(expiryDate: string, today: string): DscBucket {
  const d = diffDays(today, expiryDate);
  if (d < 0) return "Expired";
  if (d <= 7) return "7 days";
  if (d <= 15) return "15 days";
  if (d <= 30) return "30 days";
  return "Valid";
}
