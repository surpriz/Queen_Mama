import { z } from "zod";

export const signUpSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
});

export const signInSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export const updateProfileSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").optional(),
  image: z.string().url("Invalid URL").optional(),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
      .regex(/[a-z]/, "Password must contain at least one lowercase letter")
      .regex(/[0-9]/, "Password must contain at least one number"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const apiKeySchema = z.object({
  provider: z.enum(["OPENAI", "ANTHROPIC", "GEMINI", "DEEPGRAM", "GROK"]),
  apiKey: z.string().min(10, "API key is too short"),
});

export const updateUserRoleSchema = z.object({
  role: z.enum(["USER", "ADMIN", "BLOCKED"]),
});

export const adminUserQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  search: z.string().optional(),
  role: z.enum(["USER", "ADMIN", "BLOCKED"]).optional(),
});

export type SignUpInput = z.infer<typeof signUpSchema>;
export type SignInInput = z.infer<typeof signInSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type ApiKeyInput = z.infer<typeof apiKeySchema>;
export type UpdateUserRoleInput = z.infer<typeof updateUserRoleSchema>;
export type AdminUserQueryInput = z.infer<typeof adminUserQuerySchema>;

// ===========================================
// DEVICE AUTHENTICATION SCHEMAS
// ===========================================

export const deviceInfoSchema = z.object({
  deviceId: z.string().uuid("Invalid device ID"),
  name: z.string().min(1, "Device name is required").max(100),
  platform: z.enum(["macOS", "iOS", "iPadOS"]),
  osVersion: z.string().optional(),
  appVersion: z.string().optional(),
});

export const deviceCodeRequestSchema = z.object({
  deviceId: z.string().uuid("Invalid device ID"),
  deviceName: z.string().min(1).max(100).optional(),
  platform: z.string().optional(),
});

export const deviceCodePollSchema = z.object({
  deviceCode: z.string().uuid("Invalid device code"),
});

export const deviceAuthorizeSchema = z.object({
  userCode: z
    .string()
    .regex(/^[A-Z]{4}-[0-9]{4}$/, "Invalid code format (e.g., ABCD-1234)"),
});

export const macosLoginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
  deviceId: z.string().uuid("Invalid device ID"),
  deviceName: z.string().min(1).max(100),
  platform: z.enum(["macOS", "iOS", "iPadOS"]).default("macOS"),
  osVersion: z.string().optional(),
  appVersion: z.string().optional(),
});

export const macosRefreshSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token is required"),
});

export const macosLogoutSchema = z.object({
  refreshToken: z.string().optional(),
  allDevices: z.boolean().default(false),
});

// ===========================================
// LICENSE VALIDATION SCHEMAS
// ===========================================

export const licenseValidateSchema = z.object({
  deviceId: z.string().uuid("Invalid device ID"),
  appVersion: z.string().optional(),
});

// ===========================================
// SESSION SYNC SCHEMAS
// ===========================================

export const syncedAIResponseSchema = z.object({
  originalId: z.string().uuid(),
  type: z.string(),
  content: z.string(),
  provider: z.string(),
  latencyMs: z.number().int().optional(),
  timestamp: z.string().datetime(),
});

export const sessionSyncSchema = z.object({
  deviceId: z.string().uuid("Invalid device ID"),
  originalId: z.string().uuid("Invalid session ID"),
  title: z.string().min(1).max(500),
  startTime: z.string().datetime(),
  endTime: z.string().datetime().optional(),
  duration: z.number().int().min(0).optional(),
  transcript: z.string().max(1000000).optional(), // 1MB limit
  summary: z.string().max(50000).optional(),
  actionItems: z.array(z.string()).optional(),
  modeUsed: z.string().optional(),
  version: z.number().int().min(1).default(1),
  checksum: z.string().optional(),
  aiResponses: z.array(syncedAIResponseSchema).optional(),
});

export const sessionSyncBatchSchema = z.object({
  sessions: z.array(sessionSyncSchema).max(50),
});

// Type exports
export type DeviceInfo = z.infer<typeof deviceInfoSchema>;
export type DeviceCodeRequest = z.infer<typeof deviceCodeRequestSchema>;
export type DeviceCodePoll = z.infer<typeof deviceCodePollSchema>;
export type DeviceAuthorize = z.infer<typeof deviceAuthorizeSchema>;
export type MacosLogin = z.infer<typeof macosLoginSchema>;
export type MacosRefresh = z.infer<typeof macosRefreshSchema>;
export type MacosLogout = z.infer<typeof macosLogoutSchema>;
export type LicenseValidate = z.infer<typeof licenseValidateSchema>;
export type SyncedAIResponseInput = z.infer<typeof syncedAIResponseSchema>;
export type SessionSyncInput = z.infer<typeof sessionSyncSchema>;
export type SessionSyncBatchInput = z.infer<typeof sessionSyncBatchSchema>;
