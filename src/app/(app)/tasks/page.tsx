import Link from "next/link";
import { ListChecks } from "lucide-react";
import { TASK_STATUSES } from "@/db/schema";
import { requireStaff } from "@/server/auth";
import { listTasks } from "@/server/queries/work";
import { clientOptions, staffOptions } from "@/server/queries/common";
import { setTaskStatus } from "@/server/actions/work";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { DataTable } from "@/components/ui/table";
import { PriorityBadge, StatusBadge } from "@/components/ui/status-badge";
import { AssigneeChip, Avatar } from "@/components/ui/avatar";
import { DueLabel } from "@/components/ui/due";
import { EmptyState } from "@/components/ui/states";
import { FilterChips, withParams } from "@/components/ui/filter-chips";
import { SearchBox, SelectFilter } from "@/components/ui/url-filters";
import { InlineStatus } from "@/components/ui/inline-status";
import { AddTaskButton, TaskModals } from "@/components/tasks/task-form";
import { addDays, todayISO } from "@/lib/dates";
import { matches, readParams, type SearchParams } from "@/lib/params";

export const metadata = { title: "Tasks" };

export default async function TasksPage({ searchParams }: { searchParams: SearchParams }) {
  const auth = await requireStaff("tasks");
  const sp = await readParams(searchParams);
  const today = todayISO();
  const all = listTasks(auth.firm.id);
  const me = auth.user.id;
  const open = (t: (typeof all)[number]) => t.status !== "Completed";
  const VIEWS: Record<string, { label: string; test: (t: (typeof all)[number]) => boolean }> = {
    today: { label: "Today", test: (t) => open(t) && t.dueDate <= today },
    upcoming: { label: "Upcoming", test: (t) => open(t) && t.dueDate > today },
    overdue: { label: "Overdue", test: (t) => open(t) && t.dueDate < today },
    completed: { label: "Completed", test: (t) => !open(t) },
    mine: { label: "My Tasks", test: (t) => open(t) && t.assignedTo === me },
    team: { label: "Team Tasks", test: open },
    all: { label: "All", test: () => true },
  };
  const view = sp.view && sp.view in VIEWS ? sp.view : "today";
  const base = { q: sp.q, staff: sp.staff, category: sp.category };
  const rows = all
    .filter(VIEWS[view]!.test)
    .filter((t) => !sp.staff || t.assignedTo === sp.staff)
    .filter((t) => matches(sp.q, t.title, t.clientName, t.category))
    .sort((a, b) => (view === "completed" ? (b.completedAt ?? "").localeCompare(a.completedAt ?? "") : 0));
  const canEdit = auth.can("tasks", "edit");
  const staff = staffOptions(auth.firm.id);
  const editing = sp.edit ? all.find((t) => t.id === sp.edit) : null;
  const editHref = (id: string) => withParams("/tasks", { ...base, view: sp.view }, { edit: id });

  const table = (
    <DataTable
      rows={rows}
      rowKey={(r) => r.id}
      caption="Tasks"
      rowClassName={(r) => (open(r) && r.dueDate < today ? "bg-danger-bg/25" : undefined)}
      empty={<EmptyState icon={<ListChecks className="h-5.5 w-5.5" />} title={view === "today" ? "Nothing due today" : "No tasks here"} description="Enjoy the calm, or add a task for later." />}
      columns={[
        { key: "title", header: "Task Name", cell: (r) => <Link href={editHref(r.id)} scroll={false} className="font-medium hover:underline">{r.title}</Link> },
        { key: "client", header: "Client", cell: (r) => (r.clientId ? <Link href={`/clients/${r.clientId}`} className="text-ink-2 hover:underline">{r.clientName}</Link> : <span className="text-ink-4">Internal</span>) },
        { key: "cat", header: "Category", cell: (r) => <span className="text-ink-2">{r.category}</span>, hideBelow: "xl" },
        { key: "assignee", header: "Assigned To", cell: (r) => <AssigneeChip name={r.assigneeName} />, hideBelow: "lg" },
        { key: "priority", header: "Priority", cell: (r) => <PriorityBadge priority={r.priority} /> },
        { key: "due", header: "Due Date", cell: (r) => <DueLabel date={r.dueDate} done={!open(r)} today={today} /> },
        { key: "status", header: "Status", cell: (r) => (canEdit ? <InlineStatus id={r.id} status={r.status} options={TASK_STATUSES} action={setTaskStatus} label={`Status of ${r.title}`} /> : <StatusBadge status={r.status} />) },
      ]}
      mobileCard={(r) => (
        <div>
          <Link href={editHref(r.id)} scroll={false} className="block">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-semibold">{r.title}</p>
              <DueLabel date={r.dueDate} done={!open(r)} today={today} />
            </div>
            <p className="text-xs text-ink-3">{r.clientName ?? "Internal"} · {r.category}</p>
          </Link>
          <div className="mt-2 flex items-center gap-2">
            {canEdit ? <InlineStatus id={r.id} status={r.status} options={TASK_STATUSES} action={setTaskStatus} label={`Status of ${r.title}`} /> : <StatusBadge status={r.status} />}
            <PriorityBadge priority={r.priority} />
            <span className="ms-auto text-xs"><AssigneeChip name={r.assigneeName} /></span>
          </div>
        </div>
      )}
    />
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Tasks" description="Internal work, follow-ups and assignments across the team." actions={canEdit ? <AddTaskButton /> : undefined} />
      <Card>
        <div className="flex flex-col gap-3 border-b border-line p-4 lg:flex-row lg:items-center lg:justify-between">
          <FilterChips active={view} chips={Object.entries(VIEWS).map(([k, v]) => ({ key: k, label: v.label, href: withParams("/tasks", base, { view: k === "today" ? undefined : k }), count: all.filter(v.test).length }))} />
          <div className="flex flex-col gap-2 sm:flex-row">
            {view !== "mine" && <SelectFilter param="staff" label="Assigned to" placeholder="Everyone" options={staff} />}
            <SearchBox placeholder="Search tasks" className="sm:w-56" />
          </div>
        </div>
        {view === "team" ? (
          <div className="grid gap-4 p-4 md:grid-cols-2 2xl:grid-cols-3">
            {staff.filter((s) => !sp.staff || s.value === sp.staff).map((s) => {
              const mine = rows.filter((t) => t.assignedTo === s.value);
              return (
                <section key={s.value} aria-label={s.label} className="rounded-xl border border-line bg-subtle">
                  <header className="flex items-center gap-2.5 border-b border-line px-4 py-3">
                    <Avatar name={s.label} size="sm" />
                    <p className="text-sm font-semibold">{s.label}</p>
                    <span className="ms-auto text-xs text-ink-3">{mine.length} open{mine.some((t) => t.dueDate < today) && <span className="text-danger"> · {mine.filter((t) => t.dueDate < today).length} overdue</span>}</span>
                  </header>
                  <ul className="space-y-2 p-3">
                    {mine.length === 0 && <li className="py-4 text-center text-xs text-ink-4">No open tasks</li>}
                    {mine.map((t) => (
                      <li key={t.id}>
                        <Link href={editHref(t.id)} scroll={false} className="block rounded-lg border border-line bg-surface p-3 hover:border-line-strong">
                          <p className="text-[13px] font-medium">{t.title}</p>
                          <div className="mt-1.5 flex items-center gap-2 text-xs">
                            <span className="truncate text-ink-3">{t.clientName ?? "Internal"}</span>
                            <span className="ms-auto"><DueLabel date={t.dueDate} today={today} /></span>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        ) : (
          table
        )}
      </Card>
      <p className="text-xs text-ink-3">{rows.length} tasks shown · due within a week: {all.filter((t) => open(t) && t.dueDate > today && t.dueDate <= addDays(today, 7)).length}</p>
      <TaskModals canEdit={canEdit} ctx={{ clients: clientOptions(auth.firm.id), staff, today, me }} editing={editing ? { ...editing } : null} />
    </div>
  );
}
