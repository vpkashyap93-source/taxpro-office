import "server-only";
import { and, asc, desc, eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { todayISO } from "@/lib/dates";
import { listInvoices, listPayments, listRecurring } from "./invoices";
import { isComplianceDone, listChecklists, listCma, listCompliance, listDsc, listNotices, listTasks } from "./work";

export function listClients(firmId: string) {
  const clients = db.select().from(s.clients).where(eq(s.clients.firmId, firmId)).orderBy(asc(s.clients.name)).all();
  const services = db.select().from(s.clientServices).where(eq(s.clientServices.firmId, firmId)).all();
  const invoices = listInvoices(firmId);
  const compliance = listCompliance(firmId);
  const checklists = listChecklists(firmId);
  const recurring = listRecurring(firmId);
  const fyStart = todayISO().slice(0, 4);
  return clients.map((c) => {
    const inv = invoices.filter((i) => i.clientId === c.id);
    return {
      ...c,
      services: services.filter((x) => x.clientId === c.id).map((x) => x.service),
      outstanding: inv.reduce((a, i) => a + i.outstanding, 0),
      overdue: inv.filter((i) => i.status === "Overdue").reduce((a, i) => a + i.outstanding, 0),
      billedYtd: inv.filter((i) => i.invoiceDate >= `${fyStart}-04-01` && i.storedStatus !== "Draft" && i.storedStatus !== "Cancelled").reduce((a, i) => a + i.total, 0),
      pendingWork: compliance.filter((x) => x.clientId === c.id && !isComplianceDone(x.status)).length,
      pendingDocs: checklists.filter((x) => x.clientId === c.id).reduce((a, x) => a + x.pending, 0),
      monthlyFee: recurring.find((r) => r.clientId === c.id && r.active)?.amount ?? 0,
    };
  });
}
export type ClientListRow = ReturnType<typeof listClients>[number];

export function getClientProfile(firmId: string, id: string) {
  const client = db.select().from(s.clients).where(and(eq(s.clients.firmId, firmId), eq(s.clients.id, id))).get();
  if (!client) return null;
  const services = db.select({ service: s.clientServices.service }).from(s.clientServices).where(eq(s.clientServices.clientId, id)).all().map((x) => x.service);
  const manager = client.managerId ? db.select({ name: s.users.name }).from(s.users).where(eq(s.users.id, client.managerId)).get() : null;
  const activity = db
    .select({ a: s.activityLogs, userName: s.users.name })
    .from(s.activityLogs)
    .leftJoin(s.users, eq(s.users.id, s.activityLogs.userId))
    .where(and(eq(s.activityLogs.firmId, firmId), eq(s.activityLogs.clientId, id)))
    .orderBy(desc(s.activityLogs.occurredAt))
    .limit(60)
    .all()
    .map((r) => ({ ...r.a, userName: r.userName }));
  const portalUser = db.select({ id: s.users.id, email: s.users.email, active: s.users.active }).from(s.users).where(and(eq(s.users.clientId, id), eq(s.users.role, "Client"))).get();
  return {
    client,
    services,
    managerName: manager?.name ?? null,
    invoices: listInvoices(firmId, { clientId: id }),
    payments: listPayments(firmId, { clientId: id }),
    compliance: listCompliance(firmId, { clientId: id }),
    checklists: listChecklists(firmId, { clientId: id }),
    tasks: listTasks(firmId, { clientId: id }),
    cma: listCma(firmId, { clientId: id }),
    notices: listNotices(firmId, { clientId: id }),
    dsc: listDsc(firmId, { clientId: id }),
    recurring: listRecurring(firmId).find((r) => r.clientId === id) ?? null,
    activity,
    portalUser: portalUser ?? null,
  };
}
export type ClientProfile = NonNullable<ReturnType<typeof getClientProfile>>;
