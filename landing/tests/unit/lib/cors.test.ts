import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { isOriginAllowed, handleCors, corsPreflightResponse } from "@/lib/cors";

describe("isOriginAllowed", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalVercelEnv = process.env.VERCEL_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
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

  // Dev origins
  it("allows localhost in development", () => {
    process.env.NODE_ENV = "development";
    expect(isOriginAllowed("http://localhost:3000")).toBe(true);
  });

  it("blocks localhost in production", () => {
    process.env.NODE_ENV = "production";
    expect(isOriginAllowed("http://localhost:3000")).toBe(false);
  });

  it("allows 127.0.0.1 in development", () => {
    process.env.NODE_ENV = "development";
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

  // Rejected origins
  it("rejects null origin", () => {
    expect(isOriginAllowed(null)).toBe(false);
  });

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
