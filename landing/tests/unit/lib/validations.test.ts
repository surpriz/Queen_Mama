import { describe, it, expect } from "vitest";
import {
  signUpSchema,
  signInSchema,
  updateProfileSchema,
  changePasswordSchema,
  apiKeySchema,
  updateUserRoleSchema,
  updateUserPlanSchema,
  adminUserQuerySchema,
  deviceInfoSchema,
  deviceCodeRequestSchema,
  deviceCodePollSchema,
  deviceAuthorizeSchema,
  macosLoginSchema,
  macosRegisterSchema,
  macosRefreshSchema,
  macosLogoutSchema,
  licenseValidateSchema,
  syncedAIResponseSchema,
  sessionSyncSchema,
  sessionSyncBatchSchema,
  usageRecordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  checkEmailSchema,
  macosGoogleCallbackSchema,
  contactCreateSchema,
  contactUpdateSchema,
  contactNoteSchema,
  contactQuerySchema,
  contactSyncSchema,
  contactSyncBatchSchema,
  sessionContactLinkSchema,
} from "@/lib/validations";
import { VALID_PASSWORD, VALID_EMAIL, VALID_UUID, VALID_USER_CODE } from "../../helpers/fixtures";

// ============ signUpSchema ============

describe("signUpSchema", () => {
  it("accepts valid input", () => {
    const result = signUpSchema.safeParse({
      name: "John Doe",
      email: VALID_EMAIL,
      password: VALID_PASSWORD,
    });
    expect(result.success).toBe(true);
  });

  it("rejects short name", () => {
    const result = signUpSchema.safeParse({
      name: "J",
      email: VALID_EMAIL,
      password: VALID_PASSWORD,
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid email", () => {
    const result = signUpSchema.safeParse({
      name: "John",
      email: "not-email",
      password: VALID_PASSWORD,
    });
    expect(result.success).toBe(false);
  });

  it("rejects short password", () => {
    const result = signUpSchema.safeParse({
      name: "John",
      email: VALID_EMAIL,
      password: "Short1",
    });
    expect(result.success).toBe(false);
  });

  it("rejects password without uppercase", () => {
    const result = signUpSchema.safeParse({
      name: "John",
      email: VALID_EMAIL,
      password: "lowercase123",
    });
    expect(result.success).toBe(false);
  });

  it("rejects password without lowercase", () => {
    const result = signUpSchema.safeParse({
      name: "John",
      email: VALID_EMAIL,
      password: "UPPERCASE123",
    });
    expect(result.success).toBe(false);
  });

  it("rejects password without number", () => {
    const result = signUpSchema.safeParse({
      name: "John",
      email: VALID_EMAIL,
      password: "NoNumberHere",
    });
    expect(result.success).toBe(false);
  });
});

// ============ signInSchema ============

describe("signInSchema", () => {
  it("accepts valid input", () => {
    const result = signInSchema.safeParse({
      email: VALID_EMAIL,
      password: "anypassword",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty password", () => {
    const result = signInSchema.safeParse({
      email: VALID_EMAIL,
      password: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid email", () => {
    const result = signInSchema.safeParse({
      email: "bad",
      password: "pass",
    });
    expect(result.success).toBe(false);
  });
});

// ============ updateProfileSchema ============

describe("updateProfileSchema", () => {
  it("accepts valid name", () => {
    const result = updateProfileSchema.safeParse({ name: "Jane" });
    expect(result.success).toBe(true);
  });

  it("accepts valid image URL", () => {
    const result = updateProfileSchema.safeParse({
      image: "https://example.com/photo.jpg",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid image URL", () => {
    const result = updateProfileSchema.safeParse({ image: "not-a-url" });
    expect(result.success).toBe(false);
  });

  it("accepts empty object", () => {
    const result = updateProfileSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});

// ============ changePasswordSchema ============

describe("changePasswordSchema", () => {
  it("accepts matching passwords", () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: "old",
      newPassword: VALID_PASSWORD,
      confirmPassword: VALID_PASSWORD,
    });
    expect(result.success).toBe(true);
  });

  it("rejects non-matching passwords", () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: "old",
      newPassword: VALID_PASSWORD,
      confirmPassword: "Different123",
    });
    expect(result.success).toBe(false);
  });
});

// ============ apiKeySchema ============

describe("apiKeySchema", () => {
  it("accepts valid provider and key", () => {
    const result = apiKeySchema.safeParse({
      provider: "OPENAI",
      apiKey: "sk-1234567890",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid provider", () => {
    const result = apiKeySchema.safeParse({
      provider: "INVALID",
      apiKey: "sk-1234567890",
    });
    expect(result.success).toBe(false);
  });

  it("rejects short API key", () => {
    const result = apiKeySchema.safeParse({
      provider: "OPENAI",
      apiKey: "short",
    });
    expect(result.success).toBe(false);
  });

  it("accepts all valid providers", () => {
    for (const provider of ["OPENAI", "ANTHROPIC", "GEMINI", "DEEPGRAM", "GROK"]) {
      const result = apiKeySchema.safeParse({
        provider,
        apiKey: "valid-api-key-12345",
      });
      expect(result.success).toBe(true);
    }
  });
});

// ============ updateUserRoleSchema ============

describe("updateUserRoleSchema", () => {
  it.each(["USER", "ADMIN", "BLOCKED"])("accepts role %s", (role) => {
    const result = updateUserRoleSchema.safeParse({ role });
    expect(result.success).toBe(true);
  });

  it("rejects invalid role", () => {
    const result = updateUserRoleSchema.safeParse({ role: "SUPERADMIN" });
    expect(result.success).toBe(false);
  });
});

// ============ updateUserPlanSchema ============

describe("updateUserPlanSchema", () => {
  it.each(["FREE", "PRO", "ENTERPRISE"])("accepts plan %s", (plan) => {
    const result = updateUserPlanSchema.safeParse({ plan });
    expect(result.success).toBe(true);
  });

  it("accepts plan with status", () => {
    const result = updateUserPlanSchema.safeParse({
      plan: "PRO",
      status: "ACTIVE",
    });
    expect(result.success).toBe(true);
  });
});

// ============ adminUserQuerySchema ============

describe("adminUserQuerySchema", () => {
  it("accepts defaults", () => {
    const result = adminUserQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.limit).toBe(20);
    }
  });

  it("rejects limit over 100", () => {
    const result = adminUserQuerySchema.safeParse({ limit: 101 });
    expect(result.success).toBe(false);
  });

  it("accepts search with role filter", () => {
    const result = adminUserQuerySchema.safeParse({
      search: "john",
      role: "USER",
    });
    expect(result.success).toBe(true);
  });
});

// ============ Device Auth Schemas ============

describe("deviceInfoSchema", () => {
  it("accepts valid device info", () => {
    const result = deviceInfoSchema.safeParse({
      deviceId: VALID_UUID,
      name: "MacBook Pro",
      platform: "macOS",
    });
    expect(result.success).toBe(true);
  });

  it("rejects non-UUID deviceId", () => {
    const result = deviceInfoSchema.safeParse({
      deviceId: "not-a-uuid",
      name: "Mac",
      platform: "macOS",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid platform", () => {
    const result = deviceInfoSchema.safeParse({
      deviceId: VALID_UUID,
      name: "Mac",
      platform: "android",
    });
    expect(result.success).toBe(false);
  });
});

describe("deviceAuthorizeSchema", () => {
  it("accepts valid user code", () => {
    const result = deviceAuthorizeSchema.safeParse({
      userCode: VALID_USER_CODE,
    });
    expect(result.success).toBe(true);
  });

  it("rejects lowercase user code", () => {
    const result = deviceAuthorizeSchema.safeParse({
      userCode: "abcd-1234",
    });
    expect(result.success).toBe(false);
  });

  it("rejects wrong format", () => {
    const result = deviceAuthorizeSchema.safeParse({
      userCode: "12345678",
    });
    expect(result.success).toBe(false);
  });
});

describe("macosLoginSchema", () => {
  it("accepts valid login", () => {
    const result = macosLoginSchema.safeParse({
      email: VALID_EMAIL,
      password: "anypass",
      deviceId: VALID_UUID,
      deviceName: "MacBook Pro",
    });
    expect(result.success).toBe(true);
  });

  it("defaults platform to macOS", () => {
    const result = macosLoginSchema.safeParse({
      email: VALID_EMAIL,
      password: "anypass",
      deviceId: VALID_UUID,
      deviceName: "Mac",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.platform).toBe("macOS");
    }
  });
});

describe("macosRegisterSchema", () => {
  it("accepts valid registration", () => {
    const result = macosRegisterSchema.safeParse({
      name: "John Doe",
      email: VALID_EMAIL,
      password: VALID_PASSWORD,
      deviceId: VALID_UUID,
      deviceName: "Mac",
    });
    expect(result.success).toBe(true);
  });

  it("enforces password complexity", () => {
    const result = macosRegisterSchema.safeParse({
      name: "John",
      email: VALID_EMAIL,
      password: "weak",
      deviceId: VALID_UUID,
      deviceName: "Mac",
    });
    expect(result.success).toBe(false);
  });
});

// ============ Session Sync Schemas ============

describe("sessionSyncSchema", () => {
  const validSession = {
    deviceId: VALID_UUID,
    originalId: VALID_UUID,
    title: "Test Meeting",
    startTime: new Date().toISOString(),
  };

  it("accepts valid session", () => {
    const result = sessionSyncSchema.safeParse(validSession);
    expect(result.success).toBe(true);
  });

  it("defaults version to 1", () => {
    const result = sessionSyncSchema.safeParse(validSession);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.version).toBe(1);
    }
  });

  it("rejects empty title", () => {
    const result = sessionSyncSchema.safeParse({
      ...validSession,
      title: "",
    });
    expect(result.success).toBe(false);
  });

  it("accepts with AI responses", () => {
    const result = sessionSyncSchema.safeParse({
      ...validSession,
      aiResponses: [
        {
          originalId: VALID_UUID,
          type: "Assist",
          content: "Test response",
          provider: "OpenAI",
          timestamp: new Date().toISOString(),
        },
      ],
    });
    expect(result.success).toBe(true);
  });
});

describe("sessionSyncBatchSchema", () => {
  it("accepts array of sessions", () => {
    const result = sessionSyncBatchSchema.safeParse({
      sessions: [
        {
          deviceId: VALID_UUID,
          originalId: VALID_UUID,
          title: "Meeting 1",
          startTime: new Date().toISOString(),
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects more than 50 sessions", () => {
    const sessions = Array.from({ length: 51 }, (_, i) => ({
      deviceId: VALID_UUID,
      originalId: VALID_UUID,
      title: `Meeting ${i}`,
      startTime: new Date().toISOString(),
    }));
    const result = sessionSyncBatchSchema.safeParse({ sessions });
    expect(result.success).toBe(false);
  });
});

// ============ Usage Recording ============

describe("usageRecordSchema", () => {
  it("accepts valid usage record", () => {
    const result = usageRecordSchema.safeParse({
      deviceId: VALID_UUID,
      action: "ai_request",
    });
    expect(result.success).toBe(true);
  });

  it.each(["ai_request", "smart_mode", "session_start", "auto_answer"])(
    "accepts action %s",
    (action) => {
      const result = usageRecordSchema.safeParse({
        deviceId: VALID_UUID,
        action,
      });
      expect(result.success).toBe(true);
    }
  );

  it("rejects invalid action", () => {
    const result = usageRecordSchema.safeParse({
      deviceId: VALID_UUID,
      action: "invalid_action",
    });
    expect(result.success).toBe(false);
  });
});

// ============ Password Reset ============

describe("forgotPasswordSchema", () => {
  it("accepts valid email", () => {
    const result = forgotPasswordSchema.safeParse({ email: VALID_EMAIL });
    expect(result.success).toBe(true);
  });

  it("rejects invalid email", () => {
    const result = forgotPasswordSchema.safeParse({ email: "bad" });
    expect(result.success).toBe(false);
  });
});

describe("resetPasswordSchema", () => {
  it("accepts matching passwords", () => {
    const result = resetPasswordSchema.safeParse({
      token: "some-token",
      password: VALID_PASSWORD,
      confirmPassword: VALID_PASSWORD,
    });
    expect(result.success).toBe(true);
  });

  it("rejects non-matching passwords", () => {
    const result = resetPasswordSchema.safeParse({
      token: "some-token",
      password: VALID_PASSWORD,
      confirmPassword: "Mismatch123",
    });
    expect(result.success).toBe(false);
  });
});

// ============ Google OAuth ============

describe("macosGoogleCallbackSchema", () => {
  it("accepts valid callback data", () => {
    const result = macosGoogleCallbackSchema.safeParse({
      authorizationCode: "4/abc123",
      codeVerifier: "a".repeat(43),
      redirectUri: "http://localhost:8080/callback",
      deviceId: VALID_UUID,
      deviceName: "Mac",
    });
    expect(result.success).toBe(true);
  });

  it("rejects short code verifier", () => {
    const result = macosGoogleCallbackSchema.safeParse({
      authorizationCode: "4/abc",
      codeVerifier: "short",
      redirectUri: "http://localhost:8080",
      deviceId: VALID_UUID,
      deviceName: "Mac",
    });
    expect(result.success).toBe(false);
  });

  it("accepts windows platform", () => {
    const result = macosGoogleCallbackSchema.safeParse({
      authorizationCode: "4/abc123",
      codeVerifier: "a".repeat(43),
      redirectUri: "http://localhost:8080/callback",
      deviceId: "windows-device-id",
      deviceName: "Windows PC",
      platform: "windows",
    });
    expect(result.success).toBe(true);
  });
});

// ============ Contact CRM Schemas ============

describe("contactCreateSchema", () => {
  it("accepts valid contact", () => {
    const result = contactCreateSchema.safeParse({
      firstName: "John",
      lastName: "Doe",
      email: "john@example.com",
      company: "Acme",
      role: "CTO",
    });
    expect(result.success).toBe(true);
  });

  it("requires firstName", () => {
    const result = contactCreateSchema.safeParse({
      lastName: "Doe",
    });
    expect(result.success).toBe(false);
  });

  it("accepts empty email string", () => {
    const result = contactCreateSchema.safeParse({
      firstName: "John",
      email: "",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid email", () => {
    const result = contactCreateSchema.safeParse({
      firstName: "John",
      email: "not-email",
    });
    expect(result.success).toBe(false);
  });
});

describe("contactNoteSchema", () => {
  it("accepts valid note", () => {
    const result = contactNoteSchema.safeParse({ content: "A note about this contact." });
    expect(result.success).toBe(true);
  });

  it("rejects empty content", () => {
    const result = contactNoteSchema.safeParse({ content: "" });
    expect(result.success).toBe(false);
  });

  it("rejects content over 10000 chars", () => {
    const result = contactNoteSchema.safeParse({
      content: "x".repeat(10001),
    });
    expect(result.success).toBe(false);
  });
});

describe("contactSyncBatchSchema", () => {
  it("rejects more than 50 contacts", () => {
    const contacts = Array.from({ length: 51 }, (_, i) => ({
      deviceId: VALID_UUID,
      originalId: VALID_UUID,
      firstName: `Contact ${i}`,
    }));
    const result = contactSyncBatchSchema.safeParse({ contacts });
    expect(result.success).toBe(false);
  });
});

// ============ License ============

describe("licenseValidateSchema", () => {
  it("accepts valid device ID", () => {
    const result = licenseValidateSchema.safeParse({ deviceId: VALID_UUID });
    expect(result.success).toBe(true);
  });

  it("rejects non-UUID", () => {
    const result = licenseValidateSchema.safeParse({ deviceId: "bad" });
    expect(result.success).toBe(false);
  });
});

// ============ Misc ============

describe("macosRefreshSchema", () => {
  it("accepts valid refresh token", () => {
    const result = macosRefreshSchema.safeParse({ refreshToken: "abc123" });
    expect(result.success).toBe(true);
  });

  it("rejects empty refresh token", () => {
    const result = macosRefreshSchema.safeParse({ refreshToken: "" });
    expect(result.success).toBe(false);
  });
});

describe("macosLogoutSchema", () => {
  it("accepts empty object with defaults", () => {
    const result = macosLogoutSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.allDevices).toBe(false);
    }
  });

  it("accepts allDevices flag", () => {
    const result = macosLogoutSchema.safeParse({ allDevices: true });
    expect(result.success).toBe(true);
  });
});

describe("contactQuerySchema", () => {
  it("defaults page to 1 and limit to 50", () => {
    const result = contactQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.limit).toBe(50);
    }
  });

  it("rejects limit over 100", () => {
    const result = contactQuerySchema.safeParse({ limit: 101 });
    expect(result.success).toBe(false);
  });
});
