import { and, eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { db, schema as s } from "@/db";
import { getAuth } from "@/server/auth";
import { storage } from "@/server/storage";

/**
 * Authenticated file download. Staff need Documents access; client-portal users may only
 * fetch their own client's files. Files are never served from a public directory.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const doc = db.select().from(s.documents).where(and(eq(s.documents.id, id), eq(s.documents.firmId, auth.firm.id))).get();
  const allowed = auth.user.role === "Client" ? doc?.clientId === auth.user.clientId : auth.can("documents");
  if (!doc || !allowed || !doc.storageKey) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const data = await storage().get(doc.storageKey);
  if (!data) return NextResponse.json({ error: "File missing from storage" }, { status: 404 });
  const inline = req.nextUrl.searchParams.get("inline") === "1";
  const name = (doc.fileName ?? "document").replace(/"/g, "");
  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Content-Type": doc.mimeType ?? "application/octet-stream",
      "Content-Length": String(data.length),
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${name}"; filename*=UTF-8''${encodeURIComponent(name)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
