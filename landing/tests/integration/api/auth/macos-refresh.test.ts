// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { prismaMock, resetPrismaMock } from "@/tests/helpers/prisma-mock";

// Mock device-auth module
vi.mock("@/lib/device-auth", () => ({
  signAccessToken: vi.fn().mockResolvedValue("new-access-token-jwt"),
  generateRefreshToken: vi.fn().mockReturnValue("new-refresh-token"),
  hashRefreshToken: vi.fn().mockReturnValue("hashed-new-refresh-token"),
  verifyRefreshToken: vi.fn().mockReturnValue(true),
  AUTH_CONSTANTS: {
    ACCESS_TOKEN_EXPIRY_SECONDS: 900,
    REFRESH_TOKEN_EXPIRY_DAYS: 30,
    DEVICE_CODE_EXPIRY_MINUTES: 15,
    LICENSE_CACHE_TTL_SECONDS: 86400,
    MAX_DEVICES_PER_USER: 5,
  },
}));

// Mock validations
vi.mock("@/lib/validations", () => ({
  macosRefreshSchema: {
    safeParse: vi.fn((data: unknown) => {
      const d = data as { refreshToken?: string };
      if (d && d.refreshToken) {
        return { success: true, data: { refreshToken: d.refreshToken } };
      }
      return { success: false, error: { flatten: () => ({}) } };
    }),
  },
}));

import { POST, OPTIONS } from "@/app/api/auth/macos/refresh/route";

function makeRefreshRequest(body: unknown): Request {
  return new Request("http://localhost:3000/api/auth/macos/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/macos/refresh", () => {
  beforeEach(() => {
    resetPrismaMock();
  });

  // =========================================
  // OPTIONS (CORS)
  // =========================================
  it("should return 204 for OPTIONS preflight", async () => {
    const res = await OPTIONS();
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  // =========================================
  // Validation
  // =========================================
  it("should return 400 if refreshToken is missing", async () => {
    const res = await POST(makeRefreshRequest({}));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("invalid_request");
  });

  // =========================================
  // Invalid Token
  // =========================================
  it("should return 401 if refresh token is not found in DB", async () => {
    prismaMock.refreshToken.findUnique.mockResolvedValue(null);

    const res = await POST(makeRefreshRequest({ refreshToken: "invalid-token" }));
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error).toBe("invalid_token");
  });

  // =========================================
  // Expired Token
  // =========================================
  it("should return 401 if refresh token has expired", async () => {
    prismaMock.refreshToken.findUnique.mockResolvedValue({
      id: "rt-1",
      tokenHash: "hash-1",
      userId: "user-1",
      deviceId: "device-1",
      revokedAt: null,
      expiresAt: new Date(Date.now() - 1000), // expired
      createdAt: new Date(),
      user: { id: "user-1", email: "test@test.com", name: "Test", role: "USER" },
      device: { id: "dev-1", deviceId: "uuid-device", isActive: true },
    } as never);

    const res = await POST(makeRefreshRequest({ refreshToken: "expired-token" }));
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error).toBe("token_expired");
  });

  // =========================================
  // Revoked Token (past grace period)
  // =========================================
  it("should return 401 if token was revoked beyond grace period", async () => {
    prismaMock.refreshToken.findUnique.mockResolvedValue({
      id: "rt-1",
      tokenHash: "hash-1",
      userId: "user-1",
      deviceId: "device-1",
      revokedAt: new Date(Date.now() - 10 * 60 * 1000), // 10 minutes ago (past 2-min grace)
      expiresAt: new Date(Date.now() + 3600000),
      createdAt: new Date(),
      user: { id: "user-1", email: "test@test.com", name: "Test", role: "USER" },
      device: { id: "dev-1", deviceId: "uuid-device", isActive: true },
    } as never);

    const res = await POST(makeRefreshRequest({ refreshToken: "revoked-token" }));
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error).toBe("token_revoked");
  });

  // =========================================
  // Inactive Device
  // =========================================
  it("should return 401 if device is inactive", async () => {
    prismaMock.refreshToken.findUnique.mockResolvedValue({
      id: "rt-1",
      tokenHash: "hash-1",
      userId: "user-1",
      deviceId: "device-1",
      revokedAt: null,
      expiresAt: new Date(Date.now() + 3600000),
      createdAt: new Date(),
      user: { id: "user-1", email: "test@test.com", name: "Test", role: "USER" },
      device: { id: "dev-1", deviceId: "uuid-device", isActive: false },
    } as never);

    const res = await POST(makeRefreshRequest({ refreshToken: "valid-token" }));
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error).toBe("device_inactive");
  });

  // =========================================
  // Blocked User
  // =========================================
  it("should return 403 if user is blocked", async () => {
    prismaMock.refreshToken.findUnique.mockResolvedValue({
      id: "rt-1",
      tokenHash: "hash-1",
      userId: "user-1",
      deviceId: "device-1",
      revokedAt: null,
      expiresAt: new Date(Date.now() + 3600000),
      createdAt: new Date(),
      user: { id: "user-1", email: "test@test.com", name: "Test", role: "BLOCKED" },
      device: { id: "dev-1", deviceId: "uuid-device", isActive: true },
    } as never);

    const res = await POST(makeRefreshRequest({ refreshToken: "valid-token" }));
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.error).toBe("account_blocked");
  });

  // =========================================
  // Successful Refresh
  // =========================================
  it("should rotate tokens and return new access + refresh tokens on success", async () => {
    prismaMock.refreshToken.findUnique.mockResolvedValue({
      id: "rt-1",
      tokenHash: "hash-1",
      userId: "user-1",
      deviceId: "device-1",
      revokedAt: null,
      expiresAt: new Date(Date.now() + 3600000),
      createdAt: new Date(),
      user: { id: "user-1", email: "test@test.com", name: "Test User", role: "USER" },
      device: { id: "dev-1", deviceId: "uuid-device", isActive: true },
    } as never);

    prismaMock.$transaction.mockResolvedValue([{}, {}, {}] as never);

    const res = await POST(makeRefreshRequest({ refreshToken: "valid-token" }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.accessToken).toBe("new-access-token-jwt");
    expect(json.refreshToken).toBe("new-refresh-token");
    expect(json.expiresIn).toBe(900);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  // =========================================
  // Grace Period Retry
  // =========================================
  it("should handle grace period retry when recently revoked token has a newer replacement", async () => {
    // Token was recently revoked (within 2-min grace period)
    prismaMock.refreshToken.findUnique.mockResolvedValue({
      id: "rt-old",
      tokenHash: "hash-old",
      userId: "user-1",
      deviceId: "device-1",
      revokedAt: new Date(Date.now() - 30 * 1000), // 30 seconds ago
      expiresAt: new Date(Date.now() + 3600000),
      createdAt: new Date(),
      user: { id: "user-1", email: "test@test.com", name: "Test", role: "USER" },
      device: { id: "dev-1", deviceId: "uuid-device", isActive: true },
    } as never);

    // There is a newer non-revoked token
    prismaMock.refreshToken.findFirst.mockResolvedValue({
      id: "rt-new",
      tokenHash: "hash-new",
      userId: "user-1",
      deviceId: "device-1",
      revokedAt: null,
      expiresAt: new Date(Date.now() + 7200000),
      createdAt: new Date(),
    } as never);

    prismaMock.$transaction.mockResolvedValue([{}, {}] as never);

    const res = await POST(makeRefreshRequest({ refreshToken: "old-token" }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.accessToken).toBeDefined();
    expect(json.refreshToken).toBeDefined();
  });

  it("should return 401 when recently revoked but no newer token exists", async () => {
    prismaMock.refreshToken.findUnique.mockResolvedValue({
      id: "rt-old",
      tokenHash: "hash-old",
      userId: "user-1",
      deviceId: "device-1",
      revokedAt: new Date(Date.now() - 30 * 1000), // within grace period
      expiresAt: new Date(Date.now() + 3600000),
      createdAt: new Date(),
      user: { id: "user-1", email: "test@test.com", name: "Test", role: "USER" },
      device: { id: "dev-1", deviceId: "uuid-device", isActive: true },
    } as never);

    prismaMock.refreshToken.findFirst.mockResolvedValue(null);

    const res = await POST(makeRefreshRequest({ refreshToken: "old-token" }));
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error).toBe("token_revoked");
  });

  // =========================================
  // Server Error
  // =========================================
  it("should return 500 on unexpected error", async () => {
    prismaMock.refreshToken.findUnique.mockRejectedValue(new Error("DB down"));

    const res = await POST(makeRefreshRequest({ refreshToken: "any-token" }));
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error).toBe("server_error");
  });
});
