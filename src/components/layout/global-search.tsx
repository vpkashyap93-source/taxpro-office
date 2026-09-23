"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ArrowLeft, Briefcase, ClipboardCheck, FileStack, FileText, ListChecks, Search, Users } from "lucide-react";
import { cn } from "@/lib/cn";

type Group = "Clients" | "Bills" | "Tasks" | "Compliance" | "Documents";
type Hit = { id: string; title: string; subtitle: string; href: string };
type Results = Record<Group, Hit[]>;

const ICONS: Record<Group, typeof Users> = { Clients: Users, Bills: FileText, Tasks: ListChecks, Compliance: ClipboardCheck, Documents: FileStack };
const PLACEHOLDER = "Search client, PAN, GSTIN, bill no. or task...";

function useSearch(query: string) {
  const [results, setResults] = useState<Results | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      setFailed(false);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        if (!res.ok) throw new Error(String(res.status));
        setResults((await res.json()) as Results);
      } catch (e) {
        if ((e as Error).name !== "AbortError") setFailed(true);
      } finally {
        setLoading(false);
      }
    }, 180);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query]);
  return { results: query.trim().length < 2 ? null : results, loading, failed };
}

function ResultsList({ results, active, onPick, listId }: { results: Results; active: number; onPick: (h: Hit) => void; listId: string }) {
  let idx = -1;
  const groups = (Object.keys(results) as Group[]).filter((g) => results[g].length);
  if (!groups.length) return <p className="px-4 py-8 text-center text-sm text-ink-3">No matches. Try a PAN, GSTIN, mobile or invoice number.</p>;
  return (
    <div id={listId} role="listbox" className="py-1.5">
      {groups.map((g) => {
        const Icon = ICONS[g];
        return (
          <div key={g} role="group" aria-label={g} className="py-1">
            <p className="px-4 py-1 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-ink-4">{g}</p>
            {results[g].map((h) => {
              idx += 1;
              const on = idx === active;
              return (
                <button
                  key={`${g}-${h.id}`}
                  id={`${listId}-${idx}`}
                  role="option"
                  aria-selected={on}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => onPick(h)}
                  className={cn("flex w-full items-center gap-3 px-4 py-2 text-left", on ? "bg-navy-50" : "hover:bg-subtle")}
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-subtle text-ink-3">
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-ink">{h.title}</span>
                    <span className="block truncate text-xs text-ink-3">{h.subtitle}</span>
                  </span>
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

function useKeyboardNav(results: Results | null, onPick: (h: Hit) => void) {
  const [active, setActive] = useState(0);
  const flat = useMemo(() => (results ? (Object.values(results) as Hit[][]).flat() : []), [results]);
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!flat.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (a + 1) % flat.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a - 1 + flat.length) % flat.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const h = flat[Math.min(active, flat.length - 1)];
      if (h) onPick(h);
    }
  };
  return { active: Math.min(active, Math.max(0, flat.length - 1)), setActive, onKeyDown };
}

export function GlobalSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();
  const { results, loading, failed } = useSearch(q);
  const pick = (h: Hit) => {
    setOpen(false);
    setQ("");
    input.current?.blur();
    router.push(h.href);
  };
  const nav = useKeyboardNav(results, pick);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        input.current?.focus();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="relative w-full max-w-xl">
      <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-4" aria-hidden />
      <input
        ref={input}
        type="search"
        role="combobox"
        aria-expanded={open && !!results}
        aria-controls={listId}
        aria-label="Global search"
        placeholder={PLACEHOLDER}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
          nav.setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setOpen(false);
            input.current?.blur();
          }
          nav.onKeyDown(e);
        }}
        className="h-10 w-full rounded-xl border border-line bg-subtle ps-9 pe-16 text-sm text-ink placeholder:text-ink-4 transition focus:border-navy-600 focus:bg-surface focus:ring-3 focus:ring-navy-600/12 focus:outline-none"
      />
      <kbd className="pointer-events-none absolute top-1/2 right-3 hidden -translate-y-1/2 rounded-md border border-line bg-surface px-1.5 py-0.5 text-[10.5px] font-medium text-ink-3 md:block">Ctrl K</kbd>
      {open && q.trim().length >= 2 && (
        <div className="absolute inset-x-0 top-full z-50 mt-2 max-h-[70vh] overflow-y-auto rounded-xl border border-line bg-surface shadow-[var(--shadow-pop)]">
          {failed ? (
            <p className="px-4 py-6 text-center text-sm text-danger">Search is unavailable right now. Please try again.</p>
          ) : !results ? (
            <p className="px-4 py-6 text-center text-sm text-ink-3">{loading ? "Searching…" : "Type to search"}</p>
          ) : (
            <ResultsList results={results} active={nav.active} onPick={pick} listId={listId} />
          )}
        </div>
      )}
    </div>
  );
}

/** Full-screen search for phones. */
export function MobileSearch({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const listId = useId();
  const { results, loading } = useSearch(q);
  const pick = (h: Hit) => {
    onClose();
    router.push(h.href);
  };
  const nav = useKeyboardNav(results, pick);
  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-surface animate-fade-in" role="dialog" aria-label="Search">
      <div className="flex items-center gap-2 border-b border-line px-3 py-2.5">
        <button type="button" onClick={onClose} className="rounded-lg p-2 text-ink-2" aria-label="Close search">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <input
          autoFocus
          type="search"
          aria-label="Global search"
          placeholder="Search clients, PAN, GSTIN, bills…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={nav.onKeyDown}
          className="h-10 flex-1 rounded-lg bg-subtle px-3 text-[15px] focus:outline-none"
        />
      </div>
      <div className="flex-1 overflow-y-auto">
        {results ? (
          <ResultsList results={results} active={nav.active} onPick={pick} listId={listId} />
        ) : (
          <div className="flex flex-col items-center px-6 py-16 text-center text-sm text-ink-3">
            <Briefcase className="mb-3 h-6 w-6 text-ink-4" />
            {loading ? "Searching…" : "Search by client name, PAN, GSTIN, mobile, invoice number or task."}
          </div>
        )}
      </div>
    </div>
  );
}
