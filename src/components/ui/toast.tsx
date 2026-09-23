"use client";

import { CheckCircle2, AlertCircle, X } from "lucide-react";
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

type ToastKind = "success" | "error" | "info";
interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

const Ctx = createContext<(message: string, kind?: ToastKind) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((message: string, kind: ToastKind = "success") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-3), { id, kind, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 md:bottom-6 md:items-end md:pe-6">
        {toasts.map((t) => (
          <div key={t.id} role="status" className="pointer-events-auto flex w-full max-w-sm animate-slide-up items-start gap-2.5 rounded-xl border border-line bg-navy-900 px-4 py-3 text-sm text-white shadow-[var(--shadow-pop)]">
            {t.kind === "error" ? <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-300" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />}
            <span className="flex-1">{t.message}</span>
            <button type="button" aria-label="Dismiss" onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))} className="text-white/60 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
