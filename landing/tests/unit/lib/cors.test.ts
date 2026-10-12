import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { isOriginAllowed, handleCors, corsPreflightResponse } from "@/lib/cors";

describe("isOriginAllowed", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalVercelEnv = process.env.VERCEL_ENV;

  afterEach(() => {
    (process.env as Record<string, string | undefined>).NODE_ENV = originalNodeEnv;
    process.env.VERCEL_ENV = originalVercelEnv;
  });

  // Production origins
  it("allows queenmama.app", () => {
    expect(isOriginAllowed("https://queenmama.app")).toBe(true);
  });

  it("allows www.queenmama.app", () => {
    expect(isOriginAllowed("https://www.queenmama.app")).toBe(true);
  });

  it("allows queenmama.co", () => {
    expect(isOriginAllowed("https://queenmama.co")).toBe(true);
  });

  it("allows www.queenmama.co", () => {
    expect(isOriginAllowed("https://www.queenmama.co")).toBe(true);
  });

  // Desktop apps (renderer loaded from file:// → Chromium sends origin "null")
  it('allows the "null" origin used by the Windows desktop app', () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    expect(isOriginAllowed("null")).toBe(true);
  });

  it("still blocks unrelated origins in production", () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    expect(isOriginAllowed("https://evil.example")).toBe(false);
  });

  // Dev origins
  it("allows localhost in development", () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "development";
    expect(isOriginAllowed("http://localhost:3000")).toBe(true);
  });

  it("blocks localhost in production", () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    expect(isOriginAllowed("http://localhost:3000")).toBe(false);
  });

  it("allows 127.0.0.1 in development", () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "development";
    expect(isOriginAllowed("http://127.0.0.1:3000")).toBe(true);
  });

  // Preview origins
  it("allows vercel preview deployments", () => {
    process.env.VERCEL_ENV = "preview";
    expect(isOriginAllowed("https://my-app-abc123.vercel.app")).toBe(true);
  });

  it("blocks vercel preview when not in preview env", () => {
    process.env.VERCEL_ENV = "production";
    expect(isOriginAllowed("https://my-app-abc123.vercel.app")).toBe(false);
  });

  // Missing Origin header = non-browser client (curl, native apps); CORS does
  // not apply there and the function never blocked it.
  it("allows a missing Origin header", () => {
    expect(isOriginAllowed(null)).toBe(true);
  });

  // Rejected origins

  it("rejects unknown origin", () => {
    expect(isOriginAllowed("https://evil.com")).toBe(false);
  });

  it("rejects http variant of production domain", () => {
    expect(isOriginAllowed("http://queenmama.app")).toBe(false);
  });
});

describe("handleCors", () => {
  it("returns 204 for allowed OPTIONS request", () => {
    const req = new Request("http://localhost:3000/api/test", {
      method: "OPTIONS",
      headers: { origin: "https://queenmama.app" },
    });
    const result = handleCors(req);
    expect(result).not.toBeNull();
    expect(result!.status).toBe(204);
  });

  it("returns 403 for disallowed OPTIONS request", () => {
    const req = new Request("http://localhost:3000/api/test", {
      method: "OPTIONS",
      headers: { origin: "https://evil.com" },
    });
    const result = handleCors(req);
    expect(result).not.toBeNull();
    expect(result!.status).toBe(403);
  });

  it("returns null for non-OPTIONS requests", () => {
    const req = new Request("http://localhost:3000/api/test", {
      method: "GET",
      headers: { origin: "https://queenmama.app" },
    });
    const result = handleCors(req);
    expect(result).toBeNull();
  });
});

describe("corsPreflightResponse", () => {
  it("sets CORS headers for allowed origin", () => {
    const response = corsPreflightResponse("https://queenmama.app");
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
      "https://queenmama.app"
    );
    expect(response.headers.get("Access-Control-Allow-Methods")).toBeTruthy();
    expect(response.headers.get("Access-Control-Allow-Headers")).toBeTruthy();
    expect(response.headers.get("Access-Control-Max-Age")).toBe("86400");
    expect(response.headers.get("Access-Control-Allow-Credentials")).toBe(
      "true"
    );
  });

  it("does not set headers for disallowed origin", () => {
    const response = corsPreflightResponse("https://evil.com");
    expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });
});

describe("credentials for the null origin", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  afterEach(() => {
    (process.env as Record<string, string | undefined>).NODE_ENV = originalNodeEnv;
  });

  it("does not allow credentials when the origin is null", () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    const response = corsPreflightResponse("null");
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("null");
    expect(response.headers.get("Access-Control-Allow-Credentials")).toBeNull();
  });

  it("still allows credentials for a real allowed origin", () => {
    const response = corsPreflightResponse("https://queenmama.co");
    expect(response.headers.get("Access-Control-Allow-Credentials")).toBe("true");
  });
});
