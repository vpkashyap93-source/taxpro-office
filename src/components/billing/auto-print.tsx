"use client";

import { useEffect } from "react";

/** Opens the print dialog once (used by "Download" links: choose "Save as PDF"). */
export function AutoPrint({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    if (!enabled) return;
    const t = setTimeout(() => window.print(), 400);
    return () => clearTimeout(t);
  }, [enabled]);
  return null;
}
