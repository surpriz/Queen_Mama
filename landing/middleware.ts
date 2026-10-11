import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";
import { addCorsHeaders, corsPreflightResponse, isOriginAllowed } from "@/lib/cors";

const intlMiddleware = createIntlMiddleware(routing);

// Paths that should use auth middleware (not i18n)
function isAuthPath(pathname: string) {
  return (
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/signin") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/reset-password") ||
    pathname.startsWith("/verify-email") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/api")
  );
}

const authMiddleware = auth((req) => {
  const isLoggedIn = !!req.auth;
  const pathname = req.nextUrl.pathname;

  const isAuthPage = pathname.startsWith("/signin") || pathname.startsWith("/signup");
  const isDashboard = pathname.startsWith("/dashboard");
  const isAdminRoute = pathname.startsWith("/dashboard/admin");
  const isProtectedApi =
    pathname.startsWith("/api") &&
    !pathname.startsWith("/api/auth") &&
    !pathname.startsWith("/api/webhooks") &&
    !pathname.startsWith("/api/license") &&
    !pathname.startsWith("/api/proxy") &&
    !pathname.startsWith("/api/usage") &&
    !pathname.startsWith("/api/sync") &&
    !pathname.startsWith("/api/waitlist") &&
    !pathname.startsWith("/api/contact") &&
    !pathname.startsWith("/api/download") &&
    !pathname.startsWith("/api/appcast");
  const isAdminApi = pathname.startsWith("/api/admin");

  // Redirect logged-in users away from auth pages
  if (isAuthPage && isLoggedIn) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  // Require login for dashboard
  if (isDashboard && !isLoggedIn) {
    return NextResponse.redirect(new URL("/signin", req.url));
  }

  // Require admin role for admin routes
  if ((isAdminRoute || isAdminApi) && isLoggedIn) {
    if (req.auth?.user?.role !== "ADMIN") {
      if (isAdminApi) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
  }

  // Require login for protected APIs
  if (isProtectedApi && !isLoggedIn) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.next();
});

/**
 * CORS for every API route.
 *
 * Only a handful of routes wrap themselves with `withCors`; the rest relied on
 * a static `Access-Control-Allow-Origin: https://queenmama.app` header from
 * next.config.ts, which never matched the desktop apps (macOS is native, the
 * Windows app ran with `webSecurity` off, so browsers never enforced CORS on
 * them). With `webSecurity` back on, the Windows renderer (loaded from
 * `file://`, origin "null") needs a real answer on every route it calls:
 * preflight must succeed *before* the auth check (preflights carry no
 * credentials) and the actual response must echo the allowed origin.
 */
async function apiWithCors(request: NextRequest): Promise<NextResponse> {
  const origin = request.headers.get("origin");

  if (request.method === "OPTIONS") {
    return isOriginAllowed(origin)
      ? corsPreflightResponse(origin)
      : new NextResponse(null, { status: 403 });
  }

  const response = await (authMiddleware as (req: NextRequest) => Promise<NextResponse>)(request);
  return addCorsHeaders(response, origin);
}

export default async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (pathname.startsWith("/api")) {
    return apiWithCors(request);
  }

  if (isAuthPath(pathname)) {
    return (authMiddleware as (req: NextRequest) => Promise<NextResponse>)(request);
  }

  // Skip i18n for standalone pages (no locale prefix)
  if (pathname === "/get" || pathname.startsWith("/get/") || pathname.startsWith("/internal/")) {
    return NextResponse.next();
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: [
    // Match all pathnames except static files and internal Next.js paths
    "/((?!_next|_vercel|monitoring|.*\\..*).*)",
  ],
};
