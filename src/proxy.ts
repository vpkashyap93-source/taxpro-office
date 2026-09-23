import { NextResponse, type NextRequest } from "next/server";

/**
 * Optimistic check only: bounce requests without a session cookie to /login.
 * Real authentication/authorisation happens server-side in every page, action and route handler.
 */
export function proxy(req: NextRequest) {
  if (!req.cookies.has("tpo_session")) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(req.nextUrl.pathname + req.nextUrl.search)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!login|api|_next/static|_next/image|favicon.ico|forbidden|.*\\.(?:svg|png|jpg|ico|webmanifest)$).+)"],
};
