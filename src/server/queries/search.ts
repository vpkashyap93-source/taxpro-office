import "server-only";
import { and, eq, like, or, sql } from "drizzle-orm";
import { db, schema as s } from "@/db";
import type { AuthContext } from "../auth";

export interface SearchHit {
  id: string;
  title: string;
  subtitle: string;
  href: string;
}
export interface SearchResults {
  Clients: SearchHit[];
  Bills: SearchHit[];
  Tasks: SearchHit[];
  Compliance: SearchHit[];
  Documents: SearchHit[];
}

/** Permission-aware global search, grouped by entity. Uses parameterised LIKE queries. */
export function globalSearch(auth: AuthContext, raw: string): SearchResults {
  const q = raw.trim().slice(0, 60);
  const empty: SearchResults = { Clients: [], Bills: [], Tasks: [], Compliance: [], Documents: [] };
  if (q.length < 2) return empty;
  const pat = `%${q.replace(/[%_\\]/g, (m) => `\\${m}`)}%`;
  const lk = (col: Parameters<typeof like>[0]) => sql`${col} like ${pat} escape '\\'`;
  const firmId = auth.firm.id;
  const out = empty;

  if (auth.can("clients")) {
    out.Clients = db
      .select({ id: s.clients.id, name: s.clients.name, pan: s.clients.pan, gstin: s.clients.gstin, mobile: s.clients.mobile, city: s.clients.city, code: s.clients.code })
      .from(s.clients)
      .where(and(eq(s.clients.firmId, firmId), or(lk(s.clients.name), lk(s.clients.tradeName), lk(s.clients.pan), lk(s.clients.gstin), lk(s.clients.mobile), lk(s.clients.email), lk(s.clients.code))))
      .limit(6)
      .all()
      .map((c) => ({ id: c.id, title: c.name, subtitle: [c.code, c.gstin ?? c.pan, c.mobile].filter(Boolean).join(" · "), href: `/clients/${c.id}` }));
  }
  if (auth.can("billing")) {
    out.Bills = db
      .select({ id: s.invoices.id, number: s.invoices.number, client: s.clients.name, total: s.invoices.total, date: s.invoices.invoiceDate })
      .from(s.invoices)
      .innerJoin(s.clients, eq(s.clients.id, s.invoices.clientId))
      .where(and(eq(s.invoices.firmId, firmId), or(lk(s.invoices.number), lk(s.clients.name))))
      .limit(5)
      .all()
      .map((i) => ({ id: i.id, title: i.number, subtitle: `${i.client} · ₹${(i.total / 100).toLocaleString("en-IN")}`, href: `/billing/invoices/${i.id}` }));
  }
  if (auth.can("tasks")) {
    out.Tasks = db
      .select({ id: s.tasks.id, title: s.tasks.title, client: s.clients.name, status: s.tasks.status })
      .from(s.tasks)
      .leftJoin(s.clients, eq(s.clients.id, s.tasks.clientId))
      .where(and(eq(s.tasks.firmId, firmId), or(lk(s.tasks.title), lk(s.clients.name))))
      .limit(5)
      .all()
      .map((t) => ({ id: t.id, title: t.title, subtitle: [t.client, t.status].filter(Boolean).join(" · "), href: `/tasks?edit=${t.id}` }));
  }
  if (auth.can("compliance")) {
    out.Compliance = db
      .select({ id: s.complianceTasks.id, type: s.complianceTasks.complianceType, period: s.complianceTasks.period, client: s.clients.name, status: s.complianceTasks.status })
      .from(s.complianceTasks)
      .innerJoin(s.clients, eq(s.clients.id, s.complianceTasks.clientId))
      .where(and(eq(s.complianceTasks.firmId, firmId), or(lk(s.complianceTasks.complianceType), lk(s.clients.name), lk(s.clients.gstin), lk(s.clients.pan))))
      .limit(5)
      .all()
      .map((c) => ({ id: c.id, title: `${c.type} · ${c.period}`, subtitle: `${c.client} · ${c.status}`, href: `/compliance?edit=${c.id}` }));
  }
  if (auth.can("documents")) {
    out.Documents = db
      .select({ id: s.documents.id, name: s.documents.name, status: s.documents.status, checklistId: s.documents.checklistId, title: s.documentChecklists.title, client: s.clients.name })
      .from(s.documents)
      .innerJoin(s.documentChecklists, eq(s.documentChecklists.id, s.documents.checklistId))
      .innerJoin(s.clients, eq(s.clients.id, s.documents.clientId))
      .where(and(eq(s.documents.firmId, firmId), or(lk(s.documents.name), lk(s.documents.fileName), lk(s.documentChecklists.title), lk(s.clients.name))))
      .limit(5)
      .all()
      .map((d) => ({ id: d.id, title: `${d.name}`, subtitle: `${d.client} · ${d.title} · ${d.status}`, href: `/documents?checklist=${d.checklistId}` }));
  }
  return out;
}
