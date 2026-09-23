import { EmptyState } from "@/components/ui/states";
import { LinkButton } from "@/components/ui/button";
import { SearchX } from "lucide-react";

export default function NotFound() {
  return (
    <div className="rounded-[var(--radius-card)] border border-line bg-surface">
      <EmptyState icon={<SearchX className="h-5.5 w-5.5" />} title="Record not found" description="It may have been deleted, or you may not have access to it." action={<LinkButton href="/dashboard">Back to dashboard</LinkButton>} />
    </div>
  );
}
