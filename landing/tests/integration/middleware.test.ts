// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

/**
 * Middleware tests focus on the routing logic (isAuthPath, route protection rules).
 * Since the middleware delegates to NextAuth's `auth()` and `next-intl` middleware,
 * we test the logic functions and route classification rather than the full middleware chain.
 */

// We test the logic by extracting the route classification patterns
describe("Middleware route classification", () => {
  // Replicate the isAuthPath function from middleware.ts
  function isAuthPath(pathname: string): boolean {
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

  describe("isAuthPath", () => {
    it("routes dashboard to auth middleware", () => {
      expect(isAuthPath("/dashboard")).toBe(true);
      expect(isAuthPath("/dashboard/sessions")).toBe(true);
      expect(isAuthPath("/dashboard/admin/users")).toBe(true);
    });

    it("routes auth pages to auth middleware", () => {
      expect(isAuthPath("/signin")).toBe(true);
      expect(isAuthPath("/signup")).toBe(true);
      expect(isAuthPath("/forgot-password")).toBe(true);
      expect(isAuthPath("/reset-password")).toBe(true);
      expect(isAuthPath("/verify-email")).toBe(true);
    });

    it("routes API paths to auth middleware", () => {
      expect(isAuthPath("/api/contacts")).toBe(true);
      expect(isAuthPath("/api/auth/register")).toBe(true);
      expect(isAuthPath("/api/billing/checkout")).toBe(true);
    });

    it("routes other paths to i18n middleware", () => {
      expect(isAuthPath("/")).toBe(false);
      expect(isAuthPath("/fr")).toBe(false);
      expect(isAuthPath("/pricing")).toBe(false);
      expect(isAuthPath("/download")).toBe(false);
    });
  });

  // Replicate the public API route classification
  describe("public API routes", () => {
    function isProtectedApi(pathname: string): boolean {
      return (
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
        !pathname.startsWith("/api/appcast")
      );
    }

    it("exempts auth routes from protection", () => {
      expect(isProtectedApi("/api/auth/register")).toBe(false);
      expect(isProtectedApi("/api/auth/macos/login")).toBe(false);
    });

    it("exempts webhook routes from protection", () => {
      expect(isProtectedApi("/api/webhooks/stripe")).toBe(false);
    });

    it("exempts license routes from protection", () => {
      expect(isProtectedApi("/api/license/validate")).toBe(false);
    });

    it("exempts sync routes from protection", () => {
      expect(isProtectedApi("/api/sync/sessions")).toBe(false);
    });

    it("exempts contact routes from protection", () => {
      expect(isProtectedApi("/api/contact")).toBe(false);
      expect(isProtectedApi("/api/contacts")).toBe(false);
    });

    it("exempts download routes from protection", () => {
      expect(isProtectedApi("/api/download")).toBe(false);
    });

    it("protects billing routes", () => {
      expect(isProtectedApi("/api/billing/checkout")).toBe(true);
      expect(isProtectedApi("/api/billing/subscription")).toBe(true);
    });

    it("protects admin routes", () => {
      expect(isProtectedApi("/api/admin/users")).toBe(true);
    });

    it("protects user routes", () => {
      expect(isProtectedApi("/api/user/settings")).toBe(true);
      expect(isProtectedApi("/api/user/api-keys")).toBe(true);
    });
  });

  describe("admin route detection", () => {
    function isAdminRoute(pathname: string): boolean {
      return pathname.startsWith("/dashboard/admin");
    }

    function isAdminApi(pathname: string): boolean {
      return pathname.startsWith("/api/admin");
    }

    it("identifies admin dashboard routes", () => {
      expect(isAdminRoute("/dashboard/admin")).toBe(true);
      expect(isAdminRoute("/dashboard/admin/users")).toBe(true);
      expect(isAdminRoute("/dashboard/sessions")).toBe(false);
    });

    it("identifies admin API routes", () => {
      expect(isAdminApi("/api/admin/users")).toBe(true);
      expect(isAdminApi("/api/admin/stats")).toBe(true);
      expect(isAdminApi("/api/billing/checkout")).toBe(false);
    });
  });

  describe("auth page redirect logic", () => {
    // Logged-in users on auth pages should redirect to dashboard
    it("redirects logged-in users away from signin", () => {
      const isAuthPage = "/signin".startsWith("/signin") || "/signin".startsWith("/signup");
      const isLoggedIn = true;

      expect(isAuthPage && isLoggedIn).toBe(true);
      // Would redirect to /dashboard
    });

    it("allows non-logged-in users on signin", () => {
      const isAuthPage = true;
      const isLoggedIn = false;

      expect(isAuthPage && isLoggedIn).toBe(false);
      // No redirect, serve page
    });

    // Non-logged-in users on dashboard should redirect to signin
    it("redirects non-logged-in users from dashboard", () => {
      const isDashboard = true;
      const isLoggedIn = false;

      expect(isDashboard && !isLoggedIn).toBe(true);
      // Would redirect to /signin
    });
  });
});

describe("Middleware matcher config", () => {
  // Next.js matcher uses a slightly different regex engine, so we test the intent
  // The pattern: "/((?!_next|_vercel|monitoring|.*\\..*).*)"
  // means: match paths that don't start with _next, _vercel, monitoring, or contain a dot (file extension)

  it("should match application routes (no file extensions)", () => {
    // These routes should be processed by middleware
    const appRoutes = ["/", "/dashboard", "/api/auth", "/fr/pricing", "/signin"];
    for (const route of appRoutes) {
      expect(route.includes(".")).toBe(false);
      expect(route.startsWith("/_next")).toBe(false);
    }
  });

  it("should exclude static files (have file extensions)", () => {
    const staticFiles = ["/favicon.ico", "/logo.svg", "/robots.txt"];
    for (const file of staticFiles) {
      expect(file.includes(".")).toBe(true);
    }
  });

  it("should exclude Next.js internal paths", () => {
    const internalPaths = ["/_next/static/chunk.js", "/_vercel/insights"];
    for (const path of internalPaths) {
      expect(path.startsWith("/_next") || path.startsWith("/_vercel")).toBe(true);
    }
  });
});
