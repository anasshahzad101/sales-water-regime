import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/session";

/**
 * Optimistic routing only: sends signed-out visitors to /signin and picks the home page
 * by role. Real authorisation happens in the data access layer on every request.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);

  // The sign-in page decides for itself (a cookie can be validly signed but belong to a
  // deactivated user, so redirecting away from here could loop).
  if (pathname === "/signin") return NextResponse.next();
  if (!session) {
    const url = new URL("/signin", request.url);
    if (pathname !== "/") url.searchParams.set("next", pathname + request.nextUrl.search);
    return NextResponse.redirect(url);
  }
  if (pathname === "/") {
    return NextResponse.redirect(new URL(session.role === "ceo" ? "/cockpit" : "/my-week", request.url));
  }
  // Lets a page send an expired session back to sign-in with the right ?next=.
  const search = new URLSearchParams(request.nextUrl.search);
  search.delete("_rsc");
  const headers = new Headers(request.headers);
  headers.set("x-wr-path", pathname + (search.size ? `?${search}` : ""));
  return NextResponse.next({ request: { headers } });
}

export const config = {
  // Everything except Next.js internals, static files and the brand assets.
  matcher: ["/((?!_next/|brand/|icon.png|apple-icon.png|favicon.ico|robots.txt).*)"],
};
