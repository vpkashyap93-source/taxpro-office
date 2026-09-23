import { cn } from "@/lib/cn";
import { initials } from "@/lib/format";

const palette = ["bg-navy-100 text-navy-800", "bg-brand-100 text-brand-800", "bg-gold-100 text-gold", "bg-review-bg text-review", "bg-info-bg text-info"];

export function Avatar({ name, size = "md", className }: { name: string; size?: "xs" | "sm" | "md" | "lg"; className?: string }) {
  const hash = [...name].reduce((a, c) => a + c.charCodeAt(0), 0);
  const s = { xs: "h-6 w-6 text-[10px]", sm: "h-7 w-7 text-[11px]", md: "h-9 w-9 text-xs", lg: "h-14 w-14 text-lg" }[size];
  return (
    <span aria-hidden className={cn("inline-flex shrink-0 items-center justify-center rounded-full font-semibold", palette[hash % palette.length], s, className)}>
      {initials(name) || "?"}
    </span>
  );
}

export function AssigneeChip({ name }: { name: string | null | undefined }) {
  if (!name) return <span className="text-ink-4">Unassigned</span>;
  return (
    <span className="inline-flex items-center gap-2 text-ink-2">
      <Avatar name={name} size="xs" />
      <span className="truncate">{name.split(" ")[0]}</span>
    </span>
  );
}
