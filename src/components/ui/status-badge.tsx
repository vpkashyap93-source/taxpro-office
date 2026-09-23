import { Badge, type Tone } from "./badge";
import { ArrowUp, ChevronsUp, Minus, ArrowDown } from "lucide-react";

/** One consistent status → colour mapping across every module. */
const STATUS_TONES: Record<string, Tone> = {
  // generic work
  "Not Started": "neutral",
  Pending: "warn",
  "Documents Pending": "warn",
  "In Process": "info",
  "In Progress": "info",
  Review: "review",
  Completed: "ok",
  Filed: "ok",
  // invoices
  Draft: "neutral",
  Generated: "info",
  Sent: "info",
  "Partially Paid": "warn",
  Paid: "ok",
  Overdue: "danger",
  Cancelled: "neutral",
  // clients
  Active: "ok",
  Inactive: "neutral",
  Prospect: "gold",
  "On Hold": "warn",
  // documents
  Received: "ok",
  Partial: "warn",
  "Not Required": "neutral",
  // notices
  New: "danger",
  "Reply Prepared": "review",
  "Reply Submitted": "info",
  Closed: "ok",
  // CMA
  "Data Pending": "warn",
  "In Preparation": "info",
  Final: "ok",
  Submitted: "ok",
  // DSC
  "Renewal Due": "warn",
  "Renewal In Process": "info",
  Renewed: "ok",
  Expired: "danger",
  "7 days": "danger",
  "15 days": "warn",
  "30 days": "gold",
  Valid: "ok",
};

export function statusTone(status: string): Tone {
  return STATUS_TONES[status] ?? "neutral";
}

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <Badge tone={statusTone(status)} dot className={className}>
      {status}
    </Badge>
  );
}

const PRIORITY: Record<string, { tone: Tone; Icon: typeof ArrowUp }> = {
  Low: { tone: "neutral", Icon: ArrowDown },
  Medium: { tone: "info", Icon: Minus },
  High: { tone: "warn", Icon: ArrowUp },
  Critical: { tone: "danger", Icon: ChevronsUp },
};

export function PriorityBadge({ priority }: { priority: string }) {
  const p = PRIORITY[priority] ?? PRIORITY.Medium!;
  return (
    <Badge tone={p.tone} className="ps-2">
      <p.Icon aria-hidden className="h-3 w-3" strokeWidth={2.5} />
      {priority}
    </Badge>
  );
}
