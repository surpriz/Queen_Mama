// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  generateUserCode,
  generateDeviceCode,
  generateRefreshToken,
  hashRefreshToken,
  verifyRefreshToken,
  signAccessToken,
  verifyAccessToken,
  signLicenseResponse,
  verifyLicenseSignature,
  isValidDeviceId,
  AUTH_CONSTANTS,
  maxDevicesForPlan,
  MAX_DEVICES_BY_PLAN,
} from "@/lib/device-auth";

// ============ Code Generation ============

describe("generateUserCode", () => {
  it("generates code in XXXX-NNNN format", () => {
    const code = generateUserCode();
    expect(code).toMatch(/^[A-Z]{4}-[0-9]{4}$/);
  });

  it("excludes confusing characters (I, O, 0)", () => {
    // Run many times to increase chance of catching excluded chars
    for (let i = 0; i < 100; i++) {
      const code = generateUserCode();
      const [letters, digits] = code.split("-");
      expect(letters).not.toMatch(/[IO]/);
      expect(digits).not.toContain("0");
    }
  });

  it("generates unique codes", () => {
    const codes = new Set<string>();
    for (let i = 0; i < 50; i++) {
      codes.add(generateUserCode());
    }
    // With 24^4 * 9^4 = 2.18M possibilities, 50 codes should all be unique
    expect(codes.size).toBe(50);
  });
});

describe("generateDeviceCode", () => {
  it("generates valid UUID", () => {
    const code = generateDeviceCode();
    expect(code).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
  });

  it("generates unique codes", () => {
    const a = generateDeviceCode();
    const b = generateDeviceCode();
    expect(a).not.toBe(b);
  });
});

describe("generateRefreshToken", () => {
  it("generates base64url token", () => {
    const token = generateRefreshToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("generates 43+ char token (32 bytes base64url)", () => {
    const token = generateRefreshToken();
    expect(token.length).toBeGreaterThanOrEqual(43);
  });

  it("generates unique tokens", () => {
    const a = generateRefreshToken();
    const b = generateRefreshToken();
    expect(a).not.toBe(b);
  });
});

// ============ Token Hashing ============

describe("hashRefreshToken", () => {
  it("produces 64-char hex hash (SHA-256)", () => {
    const hash = hashRefreshToken("test-token");
    expect(hash.length).toBe(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("produces consistent hash for same input", () => {
    const hash1 = hashRefreshToken("test-token");
    const hash2 = hashRefreshToken("test-token");
    expect(hash1).toBe(hash2);
  });

  it("produces different hash for different input", () => {
    const hash1 = hashRefreshToken("token-a");
    const hash2 = hashRefreshToken("token-b");
    expect(hash1).not.toBe(hash2);
  });
});

describe("verifyRefreshToken", () => {
  it("returns true for correct token", () => {
    const token = generateRefreshToken();
    const hash = hashRefreshToken(token);
    expect(verifyRefreshToken(token, hash)).toBe(true);
  });

  it("returns false for wrong token", () => {
    const token = generateRefreshToken();
    const hash = hashRefreshToken(token);
    expect(verifyRefreshToken("wrong-token", hash)).toBe(false);
  });
});

// ============ JWT Tokens ============

describe("signAccessToken / verifyAccessToken", () => {
  const testPayload = {
    userId: "user-123",
    email: "test@example.com",
    name: "Test User",
    role: "USER",
    deviceId: "device-456",
  };

  it("signs and verifies a token", async () => {
    const token = await signAccessToken(testPayload);
    const payload = await verifyAccessToken(token);

    expect(payload.sub).toBe("user-123");
    expect(payload.email).toBe("test@example.com");
    expect(payload.name).toBe("Test User");
    expect(payload.role).toBe("USER");
    expect(payload.deviceId).toBe("device-456");
  });

  it("token has proper claims", async () => {
    const token = await signAccessToken(testPayload);
    const payload = await verifyAccessToken(token);

    expect(payload.iss).toBe("queenmama");
    expect(payload.aud).toBe("queenmama-macos");
    expect(payload.iat).toBeDefined();
    expect(payload.exp).toBeDefined();
  });

  it("token expires in ~15 minutes", async () => {
    const token = await signAccessToken(testPayload);
    const payload = await verifyAccessToken(token);

    const expiry = payload.exp! - payload.iat!;
    expect(expiry).toBe(15 * 60); // 900 seconds
  });

  it("rejects tampered token", async () => {
    const token = await signAccessToken(testPayload);
    const tampered = token.slice(0, -5) + "XXXXX";

    await expect(verifyAccessToken(tampered)).rejects.toThrow();
  });

  it("handles null name", async () => {
    const token = await signAccessToken({
      ...testPayload,
      name: null,
    });
    const payload = await verifyAccessToken(token);
    expect(payload.name).toBeNull();
  });
});

// ============ License Signing ============

describe("signLicenseResponse / verifyLicenseSignature", () => {
  const testData = {
    valid: true,
    plan: "PRO",
    features: { smartMode: true },
  };

  it("generates hex signature", () => {
    const sig = signLicenseResponse(testData);
    expect(sig).toMatch(/^[0-9a-f]{64}$/);
  });

  it("verifies correct signature", () => {
    const sig = signLicenseResponse(testData);
    expect(verifyLicenseSignature(testData, sig)).toBe(true);
  });

  it("rejects tampered data", () => {
    const sig = signLicenseResponse(testData);
    const tampered = { ...testData, plan: "ENTERPRISE" };
    expect(verifyLicenseSignature(tampered, sig)).toBe(false);
  });

  it("produces consistent signatures", () => {
    const sig1 = signLicenseResponse(testData);
    const sig2 = signLicenseResponse(testData);
    expect(sig1).toBe(sig2);
  });
});

// ============ Device ID Validation ============

describe("isValidDeviceId", () => {
  it("accepts valid lowercase UUID", () => {
    expect(
      isValidDeviceId("550e8400-e29b-41d4-a716-446655440000")
    ).toBe(true);
  });

  it("accepts valid uppercase UUID (Apple format)", () => {
    expect(
      isValidDeviceId("550E8400-E29B-41D4-A716-446655440000")
    ).toBe(true);
  });

  it("rejects non-UUID string", () => {
    expect(isValidDeviceId("not-a-uuid")).toBe(false);
  });

  it("rejects empty string", () => {
    expect(isValidDeviceId("")).toBe(false);
  });
});

// ============ Constants ============

describe("AUTH_CONSTANTS", () => {
  it("access token expires in 15 minutes", () => {
    expect(AUTH_CONSTANTS.ACCESS_TOKEN_EXPIRY_SECONDS).toBe(900);
  });

  it("refresh token expires in 30 days", () => {
    expect(AUTH_CONSTANTS.REFRESH_TOKEN_EXPIRY_DAYS).toBe(30);
  });

  it("device code expires in 15 minutes", () => {
    expect(AUTH_CONSTANTS.DEVICE_CODE_EXPIRY_MINUTES).toBe(15);
  });

  it("max 5 devices per user", () => {
    expect(AUTH_CONSTANTS.MAX_DEVICES_PER_USER).toBe(5);
  });

  it("inactive device TTL is 90 days", () => {
    expect(AUTH_CONSTANTS.DEVICE_INACTIVE_TTL_DAYS).toBe(90);
  });
});

describe("maxDevicesForPlan", () => {
  it("returns per-plan limits", () => {
    expect(maxDevicesForPlan("FREE")).toBe(MAX_DEVICES_BY_PLAN.FREE);
    expect(maxDevicesForPlan("PRO")).toBe(MAX_DEVICES_BY_PLAN.PRO);
    expect(maxDevicesForPlan("ENTERPRISE")).toBe(MAX_DEVICES_BY_PLAN.ENTERPRISE);
  });

  it("is case-insensitive", () => {
    expect(maxDevicesForPlan("pro")).toBe(MAX_DEVICES_BY_PLAN.PRO);
  });

  it("defaults to FREE for missing or unknown plans", () => {
    expect(maxDevicesForPlan(null)).toBe(MAX_DEVICES_BY_PLAN.FREE);
    expect(maxDevicesForPlan(undefined)).toBe(MAX_DEVICES_BY_PLAN.FREE);
    expect(maxDevicesForPlan("BOGUS")).toBe(MAX_DEVICES_BY_PLAN.FREE);
  });

  it("Enterprise allows more devices than Pro, Pro more than Free", () => {
    expect(MAX_DEVICES_BY_PLAN.ENTERPRISE).toBeGreaterThan(MAX_DEVICES_BY_PLAN.PRO);
    expect(MAX_DEVICES_BY_PLAN.PRO).toBeGreaterThan(MAX_DEVICES_BY_PLAN.FREE);
  });
});
