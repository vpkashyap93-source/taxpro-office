"use client";

import { ErrorState } from "@/components/ui/states";
import { Button } from "@/components/ui/button";

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-line bg-surface">
      <ErrorState
        description="This page could not be loaded. Your data is safe — please try again. If the problem continues, contact your administrator."
        action={<Button onClick={reset}>Try again</Button>}
      />
    </div>
  );
}
