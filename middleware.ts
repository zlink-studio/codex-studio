import { NextResponse, type NextRequest } from "next/server";
import { isAuthConfigured, SESSION_COOKIE, verifySessionToken } from "@/lib/session";

// Paths reachable without an owner session. Machine endpoints listed here
// authenticate themselves (HMAC signature or bearer token) inside the route.
const PUBLIC_PATHS = new Set([
  "/login",
  "/api/auth/login",
  "/api/n8n/callback",
  "/api/content-items/callback",
  "/api/content-items/dispatch-due"
]);

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next();

  if (!isAuthConfigured()) {
    // Local development without a password keeps working; any deployed
    // environment fails closed instead of exposing data.
    if (process.env.NODE_ENV !== "production") return NextResponse.next();
    return new NextResponse("Workbench login is not configured: set WORKBENCH_PASSWORD and WORKBENCH_SESSION_SECRET.", {
      status: 503,
      headers: { "content-type": "text/plain; charset=utf-8" }
    });
  }

  if (await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value)) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  // Everything except Next.js internals and static files in /public.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)"]
};
