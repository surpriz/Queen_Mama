// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { prismaMock, resetPrismaMock } from "@/tests/helpers/prisma-mock";
import { createTestUser } from "@/tests/helpers/fixtures";

// Mock auth module
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
  handlers: { GET: vi.fn(), POST: vi.fn() },
}));

// Mock admin module - requireAdmin throws on failure
const mockRequireAdmin = vi.fn();
vi.mock("@/lib/admin", () => ({
  requireAdmin: (...args: unknown[]) => mockRequireAdmin(...args),
}));

// Mock validations
vi.mock("@/lib/validations", () => ({
  adminUserQuerySchema: {
    safeParse: vi.fn((data: unknown) => {
      const d = data as { page?: string; limit?: string; search?: string; role?: string };
      const page = d?.page ? parseInt(d.page) : 1;
      const limit = d?.limit ? parseInt(d.limit) : 20;
      if (isNaN(page) || page < 1) {
        return { success: false, error: "Invalid page" };
      }
      return {
        success: true,
        data: {
          page,
          limit,
          search: d?.search || undefined,
          role: d?.role || undefined,
        },
      };
    }),
  },
}));

import { GET } from "@/app/api/admin/users/route";
import { NextRequest } from "next/server";

function makeGetRequest(params: Record<string, string> = {}): NextRequest {
  const searchParams = new URLSearchParams(params);
  return new NextRequest(
    `http://localhost:3000/api/admin/users?${searchParams.toString()}`,
    { method: "GET" }
  );
}

describe("GET /api/admin/users", () => {
  beforeEach(() => {
    resetPrismaMock();
    mockRequireAdmin.mockReset();
  });

  // =========================================
  // Authentication / Authorization
  // =========================================
  it("should return 401 if not authenticated", async () => {
    mockRequireAdmin.mockRejectedValue(new Error("Unauthorized"));

    const res = await GET(makeGetRequest());
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error).toBe("Unauthorized");
  });

  it("should return 403 if user is not admin", async () => {
    mockRequireAdmin.mockRejectedValue(new Error("Forbidden"));

    const res = await GET(makeGetRequest());
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.error).toBe("Forbidden");
  });

  // =========================================
  // Successful listing
  // =========================================
  it("should return paginated users for admin", async () => {
    mockRequireAdmin.mockResolvedValue({ id: "admin-id", role: "ADMIN" });

    const users = [
      {
        ...createTestUser({ id: "user-1", email: "user1@test.com" }),
        subscription: { plan: "PRO", status: "ACTIVE" },
        _count: { syncedSessions: 5, apiKeys: 2 },
      },
      {
        ...createTestUser({ id: "user-2", email: "user2@test.com" }),
        subscription: null,
        _count: { syncedSessions: 0, apiKeys: 0 },
      },
    ];

    prismaMock.user.findMany.mockResolvedValue(users as never);
    prismaMock.user.count.mockResolvedValue(2 as never);

    const res = await GET(makeGetRequest());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.users).toHaveLength(2);
    expect(json.pagination.total).toBe(2);
    expect(json.pagination.page).toBe(1);
    expect(json.pagination.limit).toBe(20);
    expect(json.pagination.totalPages).toBe(1);
  });

  it("should support pagination parameters", async () => {
    mockRequireAdmin.mockResolvedValue({ id: "admin-id", role: "ADMIN" });
    prismaMock.user.findMany.mockResolvedValue([] as never);
    prismaMock.user.count.mockResolvedValue(100 as never);

    const res = await GET(makeGetRequest({ page: "3", limit: "10" }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.pagination.page).toBe(3);
    expect(json.pagination.limit).toBe(10);
    expect(json.pagination.totalPages).toBe(10);

    // Verify skip/take in prisma call
    expect(prismaMock.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 20, // (3-1) * 10
        take: 10,
      })
    );
  });

  it("should support search parameter", async () => {
    mockRequireAdmin.mockResolvedValue({ id: "admin-id", role: "ADMIN" });
    prismaMock.user.findMany.mockResolvedValue([] as never);
    prismaMock.user.count.mockResolvedValue(0 as never);

    await GET(makeGetRequest({ search: "john" }));

    expect(prismaMock.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            { name: { contains: "john", mode: "insensitive" } },
            { email: { contains: "john", mode: "insensitive" } },
          ],
        }),
      })
    );
  });

  it("should support role filter", async () => {
    mockRequireAdmin.mockResolvedValue({ id: "admin-id", role: "ADMIN" });
    prismaMock.user.findMany.mockResolvedValue([] as never);
    prismaMock.user.count.mockResolvedValue(0 as never);

    await GET(makeGetRequest({ role: "BLOCKED" }));

    expect(prismaMock.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          role: "BLOCKED",
        }),
      })
    );
  });

  it("should combine search and role filters", async () => {
    mockRequireAdmin.mockResolvedValue({ id: "admin-id", role: "ADMIN" });
    prismaMock.user.findMany.mockResolvedValue([] as never);
    prismaMock.user.count.mockResolvedValue(0 as never);

    await GET(makeGetRequest({ search: "test", role: "USER" }));

    expect(prismaMock.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          role: "USER",
          OR: expect.any(Array),
        }),
      })
    );
  });

  // =========================================
  // Error handling
  // =========================================
  it("should return 500 on unexpected error", async () => {
    mockRequireAdmin.mockResolvedValue({ id: "admin-id", role: "ADMIN" });
    prismaMock.user.findMany.mockRejectedValue(new Error("DB crashed"));

    const res = await GET(makeGetRequest());
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error).toBe("Internal server error");
  });
});
