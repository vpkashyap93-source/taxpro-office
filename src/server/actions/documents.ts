"use server";

import { and, eq } from "drizzle-orm";
import path from "node:path";
import { z } from "zod";
import { db, schema as s } from "@/db";
import type { ActionResult } from "@/lib/action-types";
import { DOCUMENT_STATUSES } from "@/db/schema";
import { todayISO } from "@/lib/dates";
import { formatBytes } from "@/lib/format";
import { checklistSchema } from "@/lib/validation";
import { authorize } from "../auth";
import { formToObject, runAction, UserError } from "../action";
import { audit, logActivity, touched } from "../activity";
import { ALLOWED_MIME, MAX_UPLOAD_BYTES, storage } from "../storage";

const EXT_MIME: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".csv": "text/csv",
  ".txt": "text/plain",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".zip": "application/zip",
};

function ownDoc(firmId: string, id: string) {
  const d = db.select().from(s.documents).where(and(eq(s.documents.id, id), eq(s.documents.firmId, firmId))).get();
  if (!d) throw new UserError("Document not found.");
  return d;
}

function ownChecklist(firmId: string, id: string) {
  const c = db.select().from(s.documentChecklists).where(and(eq(s.documentChecklists.id, id), eq(s.documentChecklists.firmId, firmId))).get();
  if (!c) throw new UserError("Document request not found.");
  return c;
}

export async function createChecklist(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const auth = await authorize("documents", "edit");
    const raw = formToObject(fd);
    const data = checklistSchema.parse({ ...raw, items: fd.getAll("items").map(String).filter((x) => x.trim()) });
    const client = db.select({ id: s.clients.id, name: s.clients.name }).from(s.clients).where(and(eq(s.clients.id, data.clientId), eq(s.clients.firmId, auth.firm.id))).get();
    if (!client) throw new UserError("Client not found.");
    db.transaction((tx) => {
      const cl = tx
        .insert(s.documentChecklists)
        .values({ firmId: auth.firm.id, clientId: data.clientId, title: data.title, period: data.period ?? null, category: data.category, dueDate: data.dueDate ?? null, notes: data.notes ?? null, requestedAt: todayISO(), ...audit(auth) })
        .returning({ id: s.documentChecklists.id })
        .get();
      tx.insert(s.documents).values([...new Set(data.items)].map((name) => ({ firmId: auth.firm.id, checklistId: cl.id, clientId: data.clientId, name, status: "Pending" as const, ...audit(auth) }))).run();
    });
    logActivity(auth, { clientId: client.id, entityType: "document", action: "requested", summary: `Documents requested: ${data.title} (${data.items.length} items)` });
    return { ok: true, message: `Document request created for ${client.name}` };
  });
}

export async function addDocumentItem(checklistId: string, name: string): Promise<ActionResult> {
  return runAction(async () => {
    const auth = await authorize("documents", "edit");
    const n = z.string().trim().min(1, "Enter a document name").max(120).parse(name);
    const cl = ownChecklist(auth.firm.id, checklistId);
    db.insert(s.documents).values({ firmId: auth.firm.id, checklistId, clientId: cl.clientId, name: n, status: "Pending", ...audit(auth) }).run();
    return { ok: true, message: `${n} added` };
  });
}

export async function setDocumentStatus(id: string, status: string): Promise<ActionResult> {
  return runAction(async () => {
    const auth = await authorize("documents", "edit");
    const st = z.enum(DOCUMENT_STATUSES).parse(status);
    const d = ownDoc(auth.firm.id, id);
    db.update(s.documents).set({ status: st, receivedAt: st === "Received" || st === "Partial" ? (d.receivedAt ?? todayISO()) : d.receivedAt, ...touched(auth) }).where(eq(s.documents.id, id)).run();
    if (st === "Received" && d.status !== "Received") logActivity(auth, { clientId: d.clientId, entityType: "document", entityId: d.checklistId, action: "received", summary: `${d.name} received` });
    return { ok: true, message: `${d.name}: ${st}` };
  });
}

export async function setDocumentNote(id: string, note: string): Promise<ActionResult> {
  return runAction(async () => {
    const auth = await authorize("documents", "edit");
    const n = z.string().trim().max(1000).parse(note);
    ownDoc(auth.firm.id, id);
    db.update(s.documents).set({ notes: n || null, ...touched(auth) }).where(eq(s.documents.id, id)).run();
    return { ok: true, message: "Note saved" };
  });
}

/** Stores an uploaded file via the configured storage driver and marks the item Received. */
export async function uploadDocument(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const auth = await authorize("documents", "edit");
    const id = z.string().uuid("Choose which document this file is for").parse(fd.get("documentId"));
    const file = fd.get("file");
    if (!(file instanceof File) || file.size === 0) throw new UserError("Choose a file to upload.");
    if (file.size > MAX_UPLOAD_BYTES) throw new UserError(`File is too large (${formatBytes(file.size)}). Maximum is ${formatBytes(MAX_UPLOAD_BYTES)}.`);
    const ext = path.extname(file.name).toLowerCase();
    const mime = EXT_MIME[ext];
    if (!mime || !ALLOWED_MIME.has(mime)) throw new UserError("Unsupported file type. Upload PDF, image, Excel, Word, CSV, text or ZIP files.");
    const partial = fd.get("partial") === "on";
    const d = ownDoc(auth.firm.id, id);
    const key = `${auth.firm.id}/${d.checklistId}/${crypto.randomUUID()}${ext}`;
    await storage().put(key, Buffer.from(await file.arrayBuffer()), mime);
    if (d.storageKey) await storage().delete(d.storageKey).catch(() => undefined);
    const safeName = path.basename(file.name).replace(/[^\w.\- ()]/g, "_").slice(0, 150);
    db.update(s.documents)
      .set({ storageKey: key, fileName: safeName, mimeType: mime, sizeBytes: file.size, status: partial ? "Partial" : "Received", receivedAt: todayISO(), ...touched(auth) })
      .where(eq(s.documents.id, id))
      .run();
    logActivity(auth, { clientId: d.clientId, entityType: "document", entityId: d.checklistId, action: "uploaded", summary: `${d.name} uploaded (${safeName})` });
    return { ok: true, message: `${d.name} uploaded` };
  });
}

export async function removeDocumentFile(id: string): Promise<ActionResult> {
  return runAction(async () => {
    const auth = await authorize("documents", "edit");
    const d = ownDoc(auth.firm.id, id);
    if (d.storageKey) await storage().delete(d.storageKey).catch(() => undefined);
    db.update(s.documents).set({ storageKey: null, fileName: null, mimeType: null, sizeBytes: null, status: "Pending", receivedAt: null, ...touched(auth) }).where(eq(s.documents.id, id)).run();
    logActivity(auth, { clientId: d.clientId, entityType: "document", entityId: d.checklistId, action: "file-deleted", summary: `File removed from ${d.name}` });
    return { ok: true, message: "File deleted" };
  });
}

export async function deleteDocumentItem(id: string): Promise<ActionResult> {
  return runAction(async () => {
    const auth = await authorize("documents", "edit");
    const d = ownDoc(auth.firm.id, id);
    if (d.storageKey) await storage().delete(d.storageKey).catch(() => undefined);
    db.delete(s.documents).where(eq(s.documents.id, id)).run();
    return { ok: true, message: `${d.name} removed` };
  });
}

export async function deleteChecklist(id: string): Promise<ActionResult> {
  return runAction(async () => {
    const auth = await authorize("documents", "edit");
    const cl = ownChecklist(auth.firm.id, id);
    const docs = db.select({ key: s.documents.storageKey }).from(s.documents).where(eq(s.documents.checklistId, id)).all();
    for (const d of docs) if (d.key) await storage().delete(d.key).catch(() => undefined);
    db.delete(s.documentChecklists).where(eq(s.documentChecklists.id, id)).run();
    logActivity(auth, { clientId: cl.clientId, entityType: "document", action: "deleted", summary: `Document request “${cl.title}” deleted` });
    return { ok: true, message: "Document request deleted" };
  });
}

export async function logDocumentRequest(checklistId: string, via: string): Promise<ActionResult> {
  return runAction(async () => {
    const auth = await authorize("documents", "edit");
    const channel = z.enum(["WhatsApp", "Email"]).parse(via);
    const cl = ownChecklist(auth.firm.id, checklistId);
    db.update(s.documentChecklists).set({ requestedAt: todayISO(), ...touched(auth) }).where(eq(s.documentChecklists.id, checklistId)).run();
    logActivity(auth, { clientId: cl.clientId, entityType: "document", entityId: checklistId, action: "requested", summary: `Pending documents for ${cl.title} requested via ${channel}` });
    return { ok: true, message: "Request logged" };
  });
}
