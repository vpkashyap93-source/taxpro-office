"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

/** Read/write URL search params — modals (?new=1, ?edit=<id>) and filters live in the URL. */
export function useUrlState() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const patch = useCallback(
    (changes: Record<string, string | null>) => {
      const p = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(changes)) {
        if (v === null) p.delete(k);
        else p.set(k, v);
      }
      const q = p.toString();
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );
  return { params, patch };
}
