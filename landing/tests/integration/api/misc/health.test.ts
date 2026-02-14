// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { prismaMock, resetPrismaMock } from "@/tests/helpers/prisma-mock";

import { GET } from "@/app/api/health/route";

describe("GET /api/health", () => {
  beforeEach(() => {
    resetPrismaMock();
    // Set up environment variables for health check
    process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
    process.env.AUTH_SECRET = "test-secret";
    process.env.NEXTAUTH_URL = "http://localhost:3000";
  });

  it("should return 200 when database is healthy", async () => {
    prismaMock.$queryRaw.mockResolvedValue([{ "?column?": 1 }] as never);
    prismaMock.user.count.mockResolvedValue(5 as never);

    const res = await GET();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.status).toBe("ok");
    expect(json.database).toBe("connected");
    expect(json.users).toBe("5 users");
    expect(json.timestamp).toBeDefined();
  });

  it("should return 500 when database connection fails", async () => {
    prismaMock.$queryRaw.mockRejectedValue(new Error("Connection refused"));
    prismaMock.user.count.mockResolvedValue(0 as never);

    const res = await GET();
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.status).toBe("error");
    expect(json.database).toContain("error:");
  });

  it("should report missing environment variables", async () => {
    const origDB = process.env.DATABASE_URL;
    const origAuth = process.env.AUTH_SECRET;
    delete process.env.DATABASE_URL;
    delete process.env.AUTH_SECRET;

    prismaMock.$queryRaw.mockResolvedValue([{ "?column?": 1 }] as never);
    prismaMock.user.count.mockResolvedValue(0 as never);

    const res = await GET();
    const json = await res.json();

    expect(json.DATABASE_URL).toBe("MISSING");
    expect(json.AUTH_SECRET).toBe("MISSING");

    // Restore
    process.env.DATABASE_URL = origDB;
    process.env.AUTH_SECRET = origAuth;
  });

  it("should report environment variables as 'set' when present", async () => {
    prismaMock.$queryRaw.mockResolvedValue([{ "?column?": 1 }] as never);
    prismaMock.user.count.mockResolvedValue(10 as never);

    const res = await GET();
    const json = await res.json();

    expect(json.DATABASE_URL).toBe("set");
    expect(json.AUTH_SECRET).toBe("set");
    expect(json.NEXTAUTH_URL).toBe("http://localhost:3000");
  });

  it("should handle user count error gracefully", async () => {
    prismaMock.$queryRaw.mockResolvedValue([{ "?column?": 1 }] as never);
    prismaMock.user.count.mockRejectedValue(new Error("Table not found"));

    const res = await GET();
    const json = await res.json();

    // The health check should still return OK if DB connection works
    expect(json.status).toBe("ok");
    expect(json.users).toContain("error:");
  });

  it("should include a timestamp in the response", async () => {
    prismaMock.$queryRaw.mockResolvedValue([{ "?column?": 1 }] as never);
    prismaMock.user.count.mockResolvedValue(0 as never);

    const res = await GET();
    const json = await res.json();

    expect(json.timestamp).toBeDefined();
    // Verify it's a valid ISO date
    const date = new Date(json.timestamp);
    expect(date.getTime()).not.toBeNaN();
  });
});
