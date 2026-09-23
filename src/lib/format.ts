import type { MetricFormat } from "./cma";

const num = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

export function formatRupees(rupees: number) {
  return `₹${num.format(Math.round(rupees))}`;
}

export function formatMetric(value: number | null, format: MetricFormat): string {
  if (value === null || !Number.isFinite(value)) return "—";
  switch (format) {
    case "currency":
      return formatRupees(value);
    case "percent":
      return `${value.toFixed(1)}%`;
    case "days":
      return `${Math.round(value)} days`;
    case "ratio":
      return value.toFixed(2);
  }
}

export function initials(name: string): string {
  return name
    .replace(/[^A-Za-z\s&]/g, "")
    .split(/\s+/)
    .filter((w) => w && w !== "&")
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

export function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function formatBytes(bytes: number | null | undefined) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function percent(part: number, whole: number) {
  return whole === 0 ? 0 : Math.round((part / whole) * 100);
}
