// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { prismaMock, resetPrismaMock } from "@/tests/helpers/prisma-mock";

// Mock bcryptjs
vi.mock("bcryptjs", () => ({
  default: {
    compare: vi.fn().mockResolvedValue(true),
  },
}));

// Mock device-auth (JWT + token generation)
vi.mock("@/lib/device-auth", () => ({
  signAccessToken: vi.fn().mockResolvedValue("mock-access-token"),
  generateRefreshToken: vi.fn().mockReturnValue("mock-refresh-token"),
  hashRefreshToken: vi.fn().mockReturnValue("mock-refresh-hash"),
  maxDevicesForPlan: vi.fn().mockReturnValue(5),
  AUTH_CONSTANTS: {
    ACCESS_TOKEN_EXPIRY_SECONDS: 900,
    REFRESH_TOKEN_EXPIRY_DAYS: 30,
    MAX_DEVICES_PER_USER: 5,
    DEVICE_CODE_EXPIRY_MINUTES: 15,
  },
}));

import { POST } from "@/app/api/auth/macos/login/route";

function makeRequest(body: unknown): Request {
  return new Request("http://localhost:3000/api/auth/macos/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validBody = {
  email: "test@example.com",
  password: "StrongPass123",
  deviceId: "550e8400-e29b-41d4-a716-446655440000",
  deviceName: "Test MacBook",
  platform: "macOS",
  osVersion: "14.2",
  appVersion: "1.0.0",
};

const mockUser = {
  id: "user-123",
  email: "test@example.com",
  name: "Test User",
  password: "$2a$12$hashed",
  role: "USER",
};

describe("POST /api/auth/macos/login", () => {
  beforeEach(async () => {
    resetPrismaMock();
    const bcrypt = await import("bcryptjs");
    vi.mocked(bcrypt.default.compare).mockResolvedValue(true as never);
  });

  it("returns tokens for valid credentials", async () => {
    prismaMock.user.findUnique.mockResolvedValue(mockUser as never);
    prismaMock.device.count.mockResolvedValue(0);
    prismaMock.device.findUnique.mockResolvedValue(null);
    prismaMock.device.create.mockResolvedValue({ id: "device-1", deviceId: validBody.deviceId } as never);
    prismaMock.refreshToken.updateMany.mockResolvedValue({ count: 0 } as never);
    prismaMock.refreshToken.create.mockResolvedValue({} as never);

    const res = await POST(makeRequest(validBody));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.accessToken).toBe("mock-access-token");
    expect(data.refreshToken).toBe("mock-refresh-token");
    expect(data.expiresIn).toBe(900);
    expect(data.user.id).toBe("user-123");
    expect(data.user.email).toBe("test@example.com");
  });

  it("returns 401 for non-existent user", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    const res = await POST(makeRequest(validBody));
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBe("invalid_credentials");
  });

  it("returns 401 for wrong password", async () => {
    const bcrypt = await import("bcryptjs");
    vi.mocked(bcrypt.default.compare).mockResolvedValue(false as never);
    prismaMock.user.findUnique.mockResolvedValue(mockUser as never);

    const res = await POST(makeRequest(validBody));
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBe("invalid_credentials");
  });

  it("returns 400 for OAuth user without password", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      ...mockUser,
      password: null,
    } as never);
    prismaMock.account.findFirst.mockResolvedValue({
      provider: "google",
    } as never);

    const res = await POST(makeRequest(validBody));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("oauth_user");
    expect(data.authMethod).toBe("google");
  });

  it("returns 403 for blocked user", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      ...mockUser,
      role: "BLOCKED",
    } as never);

    const res = await POST(makeRequest(validBody));
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.error).toBe("account_blocked");
  });

  it("returns 403 when device limit reached", async () => {
    prismaMock.user.findUnique.mockResolvedValue(mockUser as never);
    prismaMock.device.count.mockResolvedValue(5);
    prismaMock.device.findUnique.mockResolvedValue(null);

    const res = await POST(makeRequest(validBody));
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.error).toBe("device_limit");
    expect(data.maxDevices).toBe(5);
  });

  it("updates existing device instead of creating new", async () => {
    prismaMock.user.findUnique.mockResolvedValue(mockUser as never);
    prismaMock.device.count.mockResolvedValue(1);
    prismaMock.device.findUnique.mockResolvedValue({
      id: "existing-device",
      deviceId: validBody.deviceId,
    } as never);
    prismaMock.device.update.mockResolvedValue({} as never);
    prismaMock.refreshToken.updateMany.mockResolvedValue({ count: 0 } as never);
    prismaMock.refreshToken.create.mockResolvedValue({} as never);

    const res = await POST(makeRequest(validBody));

    expect(res.status).toBe(200);
    expect(prismaMock.device.create).not.toHaveBeenCalled();
    expect(prismaMock.device.update).toHaveBeenCalled();
  });

  it("revokes existing refresh tokens for device", async () => {
    prismaMock.user.findUnique.mockResolvedValue(mockUser as never);
    prismaMock.device.count.mockResolvedValue(0);
    prismaMock.device.findUnique.mockResolvedValue(null);
    prismaMock.device.create.mockResolvedValue({ id: "device-1", deviceId: validBody.deviceId } as never);
    prismaMock.refreshToken.updateMany.mockResolvedValue({ count: 1 } as never);
    prismaMock.refreshToken.create.mockResolvedValue({} as never);

    await POST(makeRequest(validBody));

    expect(prismaMock.refreshToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          deviceId: "device-1",
          revokedAt: null,
        }),
      })
    );
  });

  it("returns 400 for invalid input (missing deviceId)", async () => {
    const { deviceId, ...bodyWithoutDevice } = validBody;
    const res = await POST(makeRequest(bodyWithoutDevice));

    expect(res.status).toBe(400);
  });

  it("lowercases email for lookup", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    await POST(makeRequest({ ...validBody, email: "Test@EXAMPLE.com" }));

    expect(prismaMock.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { email: "test@example.com" },
      })
    );
  });

  it("returns 500 on database error", async () => {
    prismaMock.user.findUnique.mockRejectedValue(new Error("DB down"));

    const res = await POST(makeRequest(validBody));
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toBe("server_error");
  });
});
