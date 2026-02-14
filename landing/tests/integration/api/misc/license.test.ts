// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { prismaMock, resetPrismaMock } from "@/tests/helpers/prisma-mock";
import { createTestUser, createTestSubscription, VALID_UUID } from "@/tests/helpers/fixtures";

// Mock device-auth
const mockVerifyAccessToken = vi.fn();
vi.mock("@/lib/device-auth", () => ({
  verifyAccessToken: (...args: unknown[]) => mockVerifyAccessToken(...args),
  signLicenseResponse: vi.fn().mockReturnValue("mock-signature-hex"),
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
  licenseValidateSchema: {
    safeParse: vi.fn((data: unknown) => {
      const d = data as { deviceId?: string };
      if (d && d.deviceId) {
        return { success: true, data: { deviceId: d.deviceId } };
      }
      return { success: false, error: { flatten: () => ({}) } };
    }),
  },
}));

import { POST } from "@/app/api/license/validate/route";

function makeRequest(body: unknown, token = "valid-token"): Request {
  return new Request("http://localhost:3000/api/license/validate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
}

function makeRequestNoAuth(body: unknown): Request {
  return new Request("http://localhost:3000/api/license/validate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/license/validate", () => {
  const tokenPayload = {
    sub: "test-user-id-123",
    email: "test@example.com",
    name: "Test User",
    role: "USER",
    deviceId: VALID_UUID,
  };

  beforeEach(() => {
    resetPrismaMock();
    mockVerifyAccessToken.mockReset();
    mockVerifyAccessToken.mockResolvedValue(tokenPayload);
  });

  // =========================================
  // Authentication
  // =========================================
  it("should return 401 if Authorization header is missing", async () => {
    const res = await POST(makeRequestNoAuth({ deviceId: VALID_UUID }));
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error).toBe("unauthorized");
  });

  it("should return 401 if access token is invalid", async () => {
    mockVerifyAccessToken.mockRejectedValue(new Error("Invalid token"));

    const res = await POST(makeRequest({ deviceId: VALID_UUID }, "bad-token"));
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error).toBe("invalid_token");
  });

  // =========================================
  // Validation
  // =========================================
  it("should return 400 if deviceId is missing", async () => {
    const res = await POST(makeRequest({}));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("invalid_request");
  });

  it("should return 403 if deviceId does not match token", async () => {
    const res = await POST(
      makeRequest({ deviceId: "00000000-0000-0000-0000-000000000000" })
    );
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.error).toBe("device_mismatch");
  });

  // =========================================
  // User checks
  // =========================================
  it("should return 404 if user is not found", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    const res = await POST(makeRequest({ deviceId: VALID_UUID }));
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error).toBe("user_not_found");
  });

  it("should return 403 if user is blocked", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      ...createTestUser({ role: "BLOCKED" }),
      subscription: null,
    } as never);

    const res = await POST(makeRequest({ deviceId: VALID_UUID }));
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.error).toBe("account_blocked");
  });

  // =========================================
  // Successful validation - FREE plan
  // =========================================
  it("should return FREE plan features when no subscription", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      ...createTestUser(),
      subscription: null,
    } as never);
    prismaMock.device.updateMany.mockResolvedValue({ count: 1 } as never);
    prismaMock.usageLog.groupBy.mockResolvedValue([] as never);

    const res = await POST(makeRequest({ deviceId: VALID_UUID }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.valid).toBe(true);
    expect(json.plan).toBe("FREE");
    expect(json.features.smartModeEnabled).toBe(false);
    expect(json.features.dailyAiRequestLimit).toBe(1);
    expect(json.features.screenshotEnabled).toBe(false);
    expect(json.signature).toBe("mock-signature-hex");
    expect(json.cacheTTL).toBe(86400);
  });

  // =========================================
  // Successful validation - PRO plan
  // =========================================
  it("should return PRO plan features with active subscription", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      ...createTestUser(),
      subscription: createTestSubscription({ plan: "PRO", status: "ACTIVE" }),
    } as never);
    prismaMock.device.updateMany.mockResolvedValue({ count: 1 } as never);
    prismaMock.usageLog.groupBy.mockResolvedValue([] as never);

    const res = await POST(makeRequest({ deviceId: VALID_UUID }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.plan).toBe("PRO");
    expect(json.features.customModesEnabled).toBe(true);
    expect(json.features.dailyAiRequestLimit).toBeNull();
    expect(json.features.screenshotEnabled).toBe(true);
    expect(json.features.smartModeEnabled).toBe(false);
  });

  // =========================================
  // Successful validation - ENTERPRISE plan
  // =========================================
  it("should return ENTERPRISE plan features", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      ...createTestUser(),
      subscription: createTestSubscription({ plan: "ENTERPRISE", status: "ACTIVE" }),
    } as never);
    prismaMock.device.updateMany.mockResolvedValue({ count: 1 } as never);
    prismaMock.usageLog.groupBy.mockResolvedValue([] as never);

    const res = await POST(makeRequest({ deviceId: VALID_UUID }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.plan).toBe("ENTERPRISE");
    expect(json.features.smartModeEnabled).toBe(true);
    expect(json.features.autoAnswerEnabled).toBe(true);
    expect(json.features.undetectableEnabled).toBe(true);
    expect(json.features.knowledgeBaseEnabled).toBe(true);
  });

  // =========================================
  // Trial info
  // =========================================
  it("should include trial info when status is TRIALING", async () => {
    const trialEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    prismaMock.user.findUnique.mockResolvedValue({
      ...createTestUser(),
      subscription: createTestSubscription({
        plan: "PRO",
        status: "TRIALING",
        currentPeriodEnd: trialEnd,
      }),
    } as never);
    prismaMock.device.updateMany.mockResolvedValue({ count: 1 } as never);
    prismaMock.usageLog.groupBy.mockResolvedValue([] as never);

    const res = await POST(makeRequest({ deviceId: VALID_UUID }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.trial).not.toBeNull();
    expect(json.trial.isActive).toBe(true);
    expect(json.trial.daysRemaining).toBeGreaterThanOrEqual(6);
    expect(json.trial.endsAt).toBeDefined();
  });

  it("should not include trial info for non-trial subscriptions", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      ...createTestUser(),
      subscription: createTestSubscription({ plan: "PRO", status: "ACTIVE" }),
    } as never);
    prismaMock.device.updateMany.mockResolvedValue({ count: 1 } as never);
    prismaMock.usageLog.groupBy.mockResolvedValue([] as never);

    const res = await POST(makeRequest({ deviceId: VALID_UUID }));
    const json = await res.json();

    expect(json.trial).toBeNull();
  });

  // =========================================
  // Usage stats
  // =========================================
  it("should include usage stats in response", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      ...createTestUser(),
      subscription: null,
    } as never);
    prismaMock.device.updateMany.mockResolvedValue({ count: 1 } as never);
    prismaMock.usageLog.groupBy.mockResolvedValue([
      { action: "ai_request", _count: { action: 3 } },
      { action: "smart_mode", _count: { action: 1 } },
    ] as never);

    const res = await POST(makeRequest({ deviceId: VALID_UUID }));
    const json = await res.json();

    expect(json.usage.aiRequestsToday).toBe(3);
    expect(json.usage.smartModeUsedToday).toBe(1);
  });

  // =========================================
  // Device update
  // =========================================
  it("should update device lastSeenAt", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      ...createTestUser(),
      subscription: null,
    } as never);
    prismaMock.device.updateMany.mockResolvedValue({ count: 1 } as never);
    prismaMock.usageLog.groupBy.mockResolvedValue([] as never);

    await POST(makeRequest({ deviceId: VALID_UUID }));

    expect(prismaMock.device.updateMany).toHaveBeenCalledWith({
      where: { deviceId: VALID_UUID },
      data: { lastSeenAt: expect.any(Date) },
    });
  });

  // =========================================
  // Server error
  // =========================================
  it("should return 500 on unexpected error", async () => {
    prismaMock.user.findUnique.mockRejectedValue(new Error("DB error"));

    const res = await POST(makeRequest({ deviceId: VALID_UUID }));
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error).toBe("server_error");
  });
});
