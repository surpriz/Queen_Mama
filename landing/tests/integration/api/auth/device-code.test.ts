// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { prismaMock, resetPrismaMock } from "@/tests/helpers/prisma-mock";
import { VALID_UUID } from "@/tests/helpers/fixtures";

// Mock device-auth module
vi.mock("@/lib/device-auth", () => ({
  generateUserCode: vi.fn().mockReturnValue("ABCD-1234"),
  generateDeviceCode: vi.fn().mockReturnValue("550e8400-e29b-41d4-a716-446655440099"),
  signAccessToken: vi.fn().mockResolvedValue("test-access-token"),
  generateRefreshToken: vi.fn().mockReturnValue("test-refresh-token"),
  hashRefreshToken: vi.fn().mockReturnValue("hashed-refresh-token"),
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
  deviceCodeRequestSchema: {
    safeParse: vi.fn((data: unknown) => {
      const d = data as { deviceId?: string; deviceName?: string; platform?: string };
      if (d && d.deviceId) {
        return {
          success: true,
          data: {
            deviceId: d.deviceId,
            deviceName: d.deviceName || "Mac",
            platform: d.platform || "macOS",
          },
        };
      }
      return { success: false, error: { flatten: () => ({}) } };
    }),
  },
  deviceCodePollSchema: {
    safeParse: vi.fn((data: unknown) => {
      const d = data as { deviceCode?: string };
      if (d && d.deviceCode) {
        return { success: true, data: { deviceCode: d.deviceCode } };
      }
      return { success: false, error: { flatten: () => ({}) } };
    }),
  },
}));

import {
  POST as codePost,
  OPTIONS as codeOptions,
} from "@/app/api/auth/device/code/route";
import {
  GET as pollGet,
  POST as pollPost,
  OPTIONS as pollOptions,
} from "@/app/api/auth/device/poll/route";
import { NextRequest } from "next/server";

// =============================================
// Helper functions
// =============================================
function makeCodeRequest(body: unknown): Request {
  return new Request("http://localhost:3000/api/auth/device/code", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makePollGetRequest(deviceCode?: string): NextRequest {
  const url = deviceCode
    ? `http://localhost:3000/api/auth/device/poll?deviceCode=${deviceCode}`
    : "http://localhost:3000/api/auth/device/poll";
  return new NextRequest(url, { method: "GET" });
}

function makePollPostRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/auth/device/poll", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// =============================================
// Device Code Generation Tests
// =============================================
describe("POST /api/auth/device/code", () => {
  beforeEach(() => {
    resetPrismaMock();
  });

  it("should return 204 for OPTIONS preflight", async () => {
    const res = await codeOptions();
    expect(res.status).toBe(204);
  });

  it("should return 400 for invalid request body", async () => {
    const res = await codePost(makeCodeRequest({}));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("Invalid request");
  });

  it("should generate device code pair successfully", async () => {
    prismaMock.deviceAuthCode.deleteMany.mockResolvedValue({ count: 0 } as never);
    prismaMock.deviceAuthCode.create.mockResolvedValue({
      id: "auth-code-1",
      userCode: "ABCD-1234",
      deviceCode: "550e8400-e29b-41d4-a716-446655440099",
      deviceId: VALID_UUID,
      deviceName: "Test Mac",
      platform: "macOS",
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      authorizedAt: null,
      userId: null,
      createdAt: new Date(),
    } as never);

    const res = await codePost(
      makeCodeRequest({
        deviceId: VALID_UUID,
        deviceName: "Test Mac",
        platform: "macOS",
      })
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.userCode).toBe("ABCD-1234");
    expect(json.deviceCode).toBe("550e8400-e29b-41d4-a716-446655440099");
    expect(json.expiresIn).toBe(15 * 60);
    expect(json.interval).toBe(5);
    expect(json.verificationUrl).toBeDefined();
  });

  it("should clean up existing codes for the same device", async () => {
    prismaMock.deviceAuthCode.deleteMany.mockResolvedValue({ count: 2 } as never);
    prismaMock.deviceAuthCode.create.mockResolvedValue({
      id: "auth-code-2",
      userCode: "ABCD-1234",
      deviceCode: "550e8400-e29b-41d4-a716-446655440099",
      deviceId: VALID_UUID,
    } as never);

    await codePost(makeCodeRequest({ deviceId: VALID_UUID }));

    expect(prismaMock.deviceAuthCode.deleteMany).toHaveBeenCalledWith({
      where: { deviceId: VALID_UUID },
    });
  });

  it("should return 500 on server error", async () => {
    prismaMock.deviceAuthCode.deleteMany.mockRejectedValue(new Error("DB error"));

    const res = await codePost(makeCodeRequest({ deviceId: VALID_UUID }));
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error).toContain("Failed to generate");
  });
});

// =============================================
// Device Poll Tests
// =============================================
describe("Device Poll endpoints", () => {
  beforeEach(() => {
    resetPrismaMock();
  });

  it("should return 204 for OPTIONS preflight", async () => {
    const res = await pollOptions();
    expect(res.status).toBe(204);
  });

  // ---- GET Poll ----
  describe("GET /api/auth/device/poll", () => {
    it("should return authorization_pending when code is not yet authorized", async () => {
      prismaMock.deviceAuthCode.findUnique.mockResolvedValue({
        id: "auth-code-1",
        userCode: "ABCD-1234",
        deviceCode: VALID_UUID,
        deviceId: "device-uuid",
        deviceName: "Mac",
        platform: "macOS",
        expiresAt: new Date(Date.now() + 600000),
        authorizedAt: null,
        userId: null,
        createdAt: new Date(),
      } as never);

      const res = await pollGet(makePollGetRequest(VALID_UUID));
      const json = await res.json();

      expect(res.status).toBe(202);
      expect(json.error).toBe("authorization_pending");
    });

    it("should return expired_token when code is not found", async () => {
      prismaMock.deviceAuthCode.findUnique.mockResolvedValue(null);

      const res = await pollGet(makePollGetRequest(VALID_UUID));
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toBe("expired_token");
    });

    it("should return expired_token when code has expired", async () => {
      prismaMock.deviceAuthCode.findUnique.mockResolvedValue({
        id: "auth-code-1",
        deviceCode: VALID_UUID,
        deviceId: "device-uuid",
        expiresAt: new Date(Date.now() - 1000), // expired
        authorizedAt: null,
        userId: null,
      } as never);
      prismaMock.deviceAuthCode.delete.mockResolvedValue({} as never);

      const res = await pollGet(makePollGetRequest(VALID_UUID));
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toBe("expired_token");
    });

    it("should return tokens when code is authorized", async () => {
      const authorizedCode = {
        id: "auth-code-1",
        deviceCode: VALID_UUID,
        deviceId: "device-uuid",
        deviceName: "Mac",
        platform: "macOS",
        expiresAt: new Date(Date.now() + 600000),
        authorizedAt: new Date(),
        userId: "user-1",
        createdAt: new Date(),
      };

      prismaMock.deviceAuthCode.findUnique.mockResolvedValue(authorizedCode as never);
      prismaMock.user.findUnique.mockResolvedValue({
        id: "user-1",
        email: "test@test.com",
        name: "Test User",
        role: "USER",
      } as never);
      prismaMock.device.findUnique.mockResolvedValue(null);
      prismaMock.device.create.mockResolvedValue({
        id: "dev-1",
        userId: "user-1",
        deviceId: "device-uuid",
        name: "Mac",
        platform: "macOS",
      } as never);
      prismaMock.refreshToken.create.mockResolvedValue({} as never);
      prismaMock.deviceAuthCode.delete.mockResolvedValue({} as never);

      const res = await pollGet(makePollGetRequest(VALID_UUID));
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.accessToken).toBe("test-access-token");
      expect(json.refreshToken).toBe("test-refresh-token");
      expect(json.expiresIn).toBe(900);
      expect(json.user.id).toBe("user-1");
      expect(json.user.email).toBe("test@test.com");
    });

    it("should return access_denied if user is blocked", async () => {
      prismaMock.deviceAuthCode.findUnique.mockResolvedValue({
        id: "auth-code-1",
        deviceCode: VALID_UUID,
        deviceId: "device-uuid",
        expiresAt: new Date(Date.now() + 600000),
        authorizedAt: new Date(),
        userId: "user-1",
      } as never);
      prismaMock.user.findUnique.mockResolvedValue({
        id: "user-1",
        email: "blocked@test.com",
        name: "Blocked User",
        role: "BLOCKED",
      } as never);

      const res = await pollGet(makePollGetRequest(VALID_UUID));
      const json = await res.json();

      expect(res.status).toBe(403);
      expect(json.error).toBe("access_denied");
    });

    it("should update existing device instead of creating new one", async () => {
      prismaMock.deviceAuthCode.findUnique.mockResolvedValue({
        id: "auth-code-1",
        deviceCode: VALID_UUID,
        deviceId: "device-uuid",
        deviceName: "Mac",
        platform: "macOS",
        expiresAt: new Date(Date.now() + 600000),
        authorizedAt: new Date(),
        userId: "user-1",
      } as never);
      prismaMock.user.findUnique.mockResolvedValue({
        id: "user-1",
        email: "test@test.com",
        name: "Test",
        role: "USER",
      } as never);
      prismaMock.device.findUnique.mockResolvedValue({
        id: "dev-existing",
        userId: "user-1",
        deviceId: "device-uuid",
      } as never);
      prismaMock.device.update.mockResolvedValue({} as never);
      prismaMock.refreshToken.create.mockResolvedValue({} as never);
      prismaMock.deviceAuthCode.delete.mockResolvedValue({} as never);

      const res = await pollGet(makePollGetRequest(VALID_UUID));
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(prismaMock.device.update).toHaveBeenCalled();
      expect(prismaMock.device.create).not.toHaveBeenCalled();
    });
  });

  // ---- POST Poll ----
  describe("POST /api/auth/device/poll", () => {
    it("should work with POST body containing deviceCode", async () => {
      prismaMock.deviceAuthCode.findUnique.mockResolvedValue({
        id: "auth-code-1",
        deviceCode: VALID_UUID,
        deviceId: "device-uuid",
        deviceName: "Mac",
        platform: "macOS",
        expiresAt: new Date(Date.now() + 600000),
        authorizedAt: null,
        userId: null,
      } as never);

      const res = await pollPost(makePollPostRequest({ deviceCode: VALID_UUID }));
      const json = await res.json();

      expect(res.status).toBe(202);
      expect(json.error).toBe("authorization_pending");
    });

    it("should return 500 on server error", async () => {
      prismaMock.deviceAuthCode.findUnique.mockRejectedValue(new Error("DB down"));

      const res = await pollPost(makePollPostRequest({ deviceCode: VALID_UUID }));
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.error).toBe("server_error");
    });
  });
});
