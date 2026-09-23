"use client";

import { Printer } from "lucide-react";
import { Button } from "./button";

export function PrintButton({ label = "Print" }: { label?: string }) {
  return (
    <Button variant="secondary" icon={<Printer className="h-4 w-4" />} onClick={() => window.print()}>
      {label}
    </Button>
  );
}
