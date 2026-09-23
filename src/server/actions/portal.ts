"use server";

import { and, eq } from "drizzle-orm";
import path from "node:path";
import { z } from "zod";
import { db, schema as s } from "@/db";
import type { ActionResult } from "@/lib/action-types";
import { todayISO } from "@/lib/dates";
import { formatBytes } from "@/lib/format";
import { AuthError, getAuth } from "../auth";
import { runAction, UserError } from "../action";
import { logActivity, notify } from "../activity";
import { ALLOWED_MIME, MAX_UPLOAD_BYTES, storage } from "../storage";

const EXT: Record<string, string> = { ".pdf": "application/pdf", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".xls": "application/vnd.ms-excel", ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ".csv": "text/csv", ".zip": "application/zip" };

/** Client-portal upload: a client can only attach files to their own pending document requests. */
export async function portalUpload(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const auth = await getAuth();
    if (!auth || auth.user.role !== "Client" || !auth.user.clientId) throw new AuthError("Please sign in to the client portal.");
    const id = z.string().uuid().parse(fd.get("documentId"));
    const file = fd.get("file");
    if (!(file instanceof File) || file.size === 0) throw new UserError("Choose a file to upload.");
    if (file.size > MAX_UPLOAD_BYTES) throw new UserError(`File is too large (${formatBytes(file.size)}).`);
    const ext = path.extname(file.name).toLowerCase();
    const mime = EXT[ext];
    if (!mime || !ALLOWED_MIME.has(mime)) throw new UserError("Please upload a PDF, image, Excel, CSV or ZIP file.");
    const doc = db.select().from(s.documents).where(and(eq(s.documents.id, id), eq(s.documents.clientId, auth.user.clientId), eq(s.documents.firmId, auth.firm.id))).get();
    if (!doc) throw new UserError("Document request not found.");
    const key = `${auth.firm.id}/${doc.checklistId}/${crypto.randomUUID()}${ext}`;
    await storage().put(key, Buffer.from(await file.arrayBuffer()), mime);
    if (doc.storageKey) await storage().delete(doc.storageKey).catch(() => undefined);
    db.update(s.documents)
      .set({ storageKey: key, fileName: path.basename(file.name).replace(/[^\w.\- ()]/g, "_").slice(0, 150), mimeType: mime, sizeBytes: file.size, status: "Received", receivedAt: todayISO(), updatedBy: auth.user.id, updatedAt: new Date().toISOString() })
      .where(eq(s.documents.id, id))
      .run();
    logActivity(auth, { clientId: doc.clientId, entityType: "document", entityId: doc.checklistId, action: "uploaded", summary: `${doc.name} uploaded by client via portal` });
    const manager = db.select({ managerId: s.clients.managerId }).from(s.clients).where(eq(s.clients.id, doc.clientId)).get()?.managerId;
    notify(auth, manager, { kind: "document", title: "Client uploaded a document", body: `${auth.user.name}: ${doc.name}`, href: `/documents?checklist=${doc.checklistId}`, dedupeKey: `portal-upload:${id}:${Date.now()}` });
    return { ok: true, message: `${doc.name} uploaded — thank you!` };
  });
}
