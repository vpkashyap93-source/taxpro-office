import { NextResponse, type NextRequest } from "next/server";
import { getAuth } from "@/server/auth";
import { logActivity } from "@/server/activity";
import { buildReport, defaultFilters, REPORTS, toCsv, type ReportKey } from "@/server/queries/reports";

/** CSV export of any report the user may view. Logged as a digital report for paperless metrics. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ key: string }> }) {
  const auth = await getAuth();
  if (!auth || auth.user.role === "Client" || !auth.can("reports")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { key } = await ctx.params;
  if (!REPORTS.some((r) => r.key === key)) return NextResponse.json({ error: "Unknown report" }, { status: 404 });
  const sp = Object.fromEntries(req.nextUrl.searchParams.entries());
  const report = buildReport(auth, key as ReportKey, defaultFilters(sp));
  if (!report) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  logActivity(auth, { entityType: "report", action: "exported", summary: `${report.title} exported (CSV)` });
  const filename = `${key}-${new Date().toISOString().slice(0, 10)}.csv`;
  return new NextResponse("﻿" + toCsv(report), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${filename}"`, "Cache-Control": "no-store" },
  });
}
