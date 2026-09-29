import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { requireStaff } from "@/server/auth";
import { calendarItems, CALENDAR_CATEGORIES, type CalendarItem } from "@/server/queries/calendar";
import { listEvents } from "@/server/queries/work";
import { clientOptions } from "@/server/queries/common";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { FilterChips, withParams } from "@/components/ui/filter-chips";
import { SelectFilter } from "@/components/ui/url-filters";
import { EmptyState } from "@/components/ui/states";
import { AddEventButton, EventModals } from "@/components/calendar/event-form";
import { addDays, addMonths, endOfMonth, longDate, monthLabel, parseISODate, startOfMonth, todayISO, formatDate } from "@/lib/dates";
import { readParams, type SearchParams } from "@/lib/params";
import { cn } from "@/lib/cn";

export const metadata = { title: "Calendar" };

const COLORS: Record<string, { dot: string; chip: string }> = {
  Compliance: { dot: "bg-navy-600", chip: "bg-navy-50 text-navy-800 border-navy-100" },
  "Bill Due": { dot: "bg-brand-500", chip: "bg-brand-50 text-brand-800 border-brand-100" },
  Task: { dot: "bg-ink-3", chip: "bg-subtle text-ink-2 border-line" },
  Meeting: { dot: "bg-gold-400", chip: "bg-gold-50 text-gold border-gold-100" },
  CMA: { dot: "bg-review", chip: "bg-review-bg text-review border-review-line" },
  "DSC Expiry": { dot: "bg-warn", chip: "bg-warn-bg text-warn border-warn-line" },
  Notice: { dot: "bg-danger", chip: "bg-danger-bg text-danger border-danger-line" },
};

const dow = (iso: string) => (parseISODate(iso).getUTCDay() + 6) % 7; // Monday = 0
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default async function CalendarPage({ searchParams }: { searchParams: SearchParams }) {
  const auth = await requireStaff("calendar");
  const sp = await readParams(searchParams);
  const today = todayISO();
  const view = sp.view === "week" || sp.view === "day" ? sp.view : "month";
  const date = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : today;

  let from: string, to: string, prev: string, next: string, title: string;
  if (view === "month") {
    from = addDays(startOfMonth(date), -dow(startOfMonth(date)));
    to = addDays(endOfMonth(date), 6 - dow(endOfMonth(date)));
    prev = addMonths(startOfMonth(date), -1);
    next = addMonths(startOfMonth(date), 1);
    title = monthLabel(date, "long");
  } else if (view === "week") {
    from = addDays(date, -dow(date));
    to = addDays(from, 6);
    prev = addDays(from, -7);
    next = addDays(from, 7);
    title = `${formatDate(from, { year: false })} – ${formatDate(to)}`;
  } else {
    from = to = date;
    prev = addDays(date, -1);
    next = addDays(date, 1);
    title = longDate(date);
  }

  const finance = auth.can("billing");
  const items = calendarItems(auth.firm.id, from, to, { includeFinance: finance }).filter((i) => !sp.category || i.category === sp.category);
  const byDay = new Map<string, CalendarItem[]>();
  for (const i of items) byDay.set(i.date, [...(byDay.get(i.date) ?? []), i]);
  const days: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) days.push(d);
  const selected = sp.date ?? today;
  const base = { view: sp.view, category: sp.category };
  const link = (patch: Record<string, string | undefined>) => withParams("/calendar", { ...base, date: sp.date }, patch);
  const editing = sp.event ? listEvents(auth.firm.id, "0000-01-01", "9999-12-31").find((e) => e.id === sp.event) : null;
  const categories = CALENDAR_CATEGORIES.filter((c) => finance || c !== "Bill Due");

  return (
    <div className="space-y-5">
      <PageHeader title="Calendar" description="Every deadline, due bill, task and meeting in one view." actions={auth.can("calendar", "edit") ? <AddEventButton /> : undefined} />
      <Card>
        <div className="flex flex-col gap-3 border-b border-line p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2">
            <Link href={link({ date: prev })} scroll={false} aria-label="Previous" className="rounded-lg border border-line-strong p-1.5 text-ink-2 hover:bg-subtle"><ChevronLeft className="h-4 w-4" /></Link>
            <Link href={link({ date: next })} scroll={false} aria-label="Next" className="rounded-lg border border-line-strong p-1.5 text-ink-2 hover:bg-subtle"><ChevronRight className="h-4 w-4" /></Link>
            <Link href={link({ date: undefined })} scroll={false} className="rounded-lg border border-line-strong px-3 py-1.5 text-[13px] font-medium text-ink-2 hover:bg-subtle">Today</Link>
            <h2 className="ms-2 text-base font-semibold">{title}</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <SelectFilter param="category" label="Category" placeholder="All categories" options={categories} />
            <FilterChips active={view} label="View" chips={(["month", "week", "day"] as const).map((v) => ({ key: v, label: v[0]!.toUpperCase() + v.slice(1), href: withParams("/calendar", { category: sp.category, date: sp.date }, { view: v === "month" ? undefined : v }) }))} />
          </div>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 border-b border-line px-4 py-2.5 text-xs text-ink-2">
          {categories.map((c) => (
            <span key={c} className="inline-flex items-center gap-1.5"><span className={cn("h-2 w-2 rounded-full", COLORS[c]!.dot)} />{c}</span>
          ))}
        </div>

        {view === "month" && (
          <div>
            <div className="grid grid-cols-7 border-b border-line bg-subtle text-center text-[11px] font-semibold tracking-[0.06em] text-ink-3 uppercase">
              {WEEKDAYS.map((d) => <div key={d} className="py-2">{d}</div>)}
            </div>
            <div className="grid grid-cols-7">
              {days.map((d) => {
                const list = byDay.get(d) ?? [];
                const inMonth = d.slice(0, 7) === date.slice(0, 7);
                const isToday = d === today;
                return (
                  <Link
                    key={d}
                    href={link({ date: d })}
                    scroll={false}
                    aria-label={`${formatDate(d)}: ${list.length} items`}
                    className={cn("group min-h-16 border-b border-r border-line p-1.5 text-left last:border-r-0 md:min-h-28 md:p-2 [&:nth-child(7n)]:border-r-0", !inMonth && "bg-subtle/60", d === selected && "ring-2 ring-navy-600 ring-inset")}
                  >
                    <span className={cn("tnum inline-flex h-6 w-6 items-center justify-center rounded-full text-xs", isToday ? "bg-navy-900 font-semibold text-white" : inMonth ? "text-ink" : "text-ink-4")}>{Number(d.slice(8))}</span>
                    <div className="mt-1 flex flex-wrap gap-0.5 md:hidden">
                      {list.slice(0, 4).map((i) => <span key={i.id} className={cn("h-1.5 w-1.5 rounded-full", COLORS[i.category]!.dot, i.done && "opacity-40")} />)}
                    </div>
                    <ul className="mt-1 hidden space-y-0.5 md:block">
                      {list.slice(0, 3).map((i) => (
                        <li key={i.id} className={cn("truncate rounded border px-1.5 py-px text-[11px] leading-4", COLORS[i.category]!.chip, i.done && "line-through opacity-50")}>{i.time ? `${i.time} ` : ""}{i.title}</li>
                      ))}
                      {list.length > 3 && <li className="px-1 text-[11px] text-ink-3">+{list.length - 3} more</li>}
                    </ul>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {view === "week" && (
          <div className="grid grid-cols-1 divide-y divide-line md:grid-cols-7 md:divide-x md:divide-y-0">
            {days.map((d) => {
              const list = byDay.get(d) ?? [];
              return (
                <div key={d} className="min-h-40 min-w-0 p-2">
                  <Link href={withParams("/calendar", { category: sp.category }, { view: "day", date: d })} className={cn("mb-2 flex items-baseline gap-1.5 rounded-md px-1 text-sm", d === today && "text-navy-900")}>
                    <span className="text-xs text-ink-3 uppercase">{WEEKDAYS[dow(d)]}</span>
                    <span className={cn("tnum font-semibold", d === today && "rounded-full bg-navy-900 px-1.5 text-white")}>{Number(d.slice(8))}</span>
                  </Link>
                  <AgendaList items={list} compact />
                </div>
              );
            })}
          </div>
        )}

        {view === "day" && (
          <div className="p-4">
            <AgendaList items={byDay.get(date) ?? []} />
          </div>
        )}
      </Card>

      {view === "month" && (
        <Card>
          <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
            <h2 className="text-[15px] font-semibold">{longDate(selected)}</h2>
            <Link href={withParams("/calendar", { category: sp.category }, { view: "day", date: selected })} className="text-[13px] font-medium text-navy-600 hover:underline">Open day</Link>
          </div>
          <div className="p-4">
            <AgendaList items={(byDay.get(selected) ?? calendarItems(auth.firm.id, selected, selected, { includeFinance: finance }).filter((i) => !sp.category || i.category === sp.category))} />
          </div>
        </Card>
      )}
      <EventModals clients={clientOptions(auth.firm.id)} canEdit={auth.can("calendar", "edit")} defaultDate={selected} editing={editing ? { ...editing } : null} />
    </div>
  );
}

function AgendaList({ items, compact }: { items: CalendarItem[]; compact?: boolean }) {
  if (!items.length) return compact ? <p className="px-1 text-xs text-ink-4">—</p> : <EmptyState title="Nothing scheduled" className="py-8" />;
  return (
    <ul className={compact ? "space-y-1" : "divide-y divide-line"}>
      {items.map((i) => (
        <li key={i.id}>
          <Link href={i.href} scroll={false} className={cn("flex items-start gap-2.5 rounded-lg hover:bg-subtle", compact ? "border px-2 py-1.5 " + COLORS[i.category]!.chip : "px-2 py-2.5")}>
            {!compact && <span className={cn("mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full", COLORS[i.category]!.dot)} />}
            <span className="min-w-0">
              <span className={cn("block truncate font-medium", compact ? "text-[11.5px]" : "text-sm text-ink", i.done && "line-through opacity-60")}>
                {i.time && <span className="tnum me-1">{i.time}</span>}
                {i.title}
              </span>
              {!compact && <span className="block truncate text-xs text-ink-3">{i.category}{i.subtitle ? ` · ${i.subtitle}` : ""}</span>}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
