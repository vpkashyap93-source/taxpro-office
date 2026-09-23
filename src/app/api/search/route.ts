import { NextResponse, type NextRequest } from "next/server";
import { getAuth } from "@/server/auth";
import { globalSearch } from "@/server/queries/search";

export async function GET(req: NextRequest) {
  const auth = await getAuth();
  if (!auth || auth.user.role === "Client") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const q = req.nextUrl.searchParams.get("q") ?? "";
  return NextResponse.json(globalSearch(auth, q), { headers: { "Cache-Control": "no-store" } });
}
