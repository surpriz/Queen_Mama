/**
 * Shared test data factories for landing app tests
 */

export function createTestUser(overrides: Record<string, unknown> = {}) {
  return {
    id: "test-user-id-123",
    email: "test@example.com",
    name: "Test User",
    role: "USER",
    emailVerified: new Date(),
    hashedPassword: "$2a$12$fakehash",
    image: null,
    createdAt: new Date("2025-01-01"),
    updatedAt: new Date("2025-01-01"),
    ...overrides,
  };
}

export function createTestDevice(overrides: Record<string, unknown> = {}) {
  return {
    id: "test-device-id",
    userId: "test-user-id-123",
    deviceId: "550e8400-e29b-41d4-a716-446655440000",
    name: "Test Mac",
    platform: "macOS",
    lastActiveAt: new Date(),
    createdAt: new Date(),
    ...overrides,
  };
}

export function createTestContact(overrides: Record<string, unknown> = {}) {
  return {
    id: "test-contact-id",
    userId: "test-user-id-123",
    firstName: "John",
    lastName: "Doe",
    email: "john@example.com",
    company: "Acme Corp",
    role: "CTO",
    lastSeenAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export function createTestSubscription(
  overrides: Record<string, unknown> = {}
) {
  return {
    id: "test-sub-id",
    userId: "test-user-id-123",
    plan: "PRO",
    status: "ACTIVE",
    stripeCustomerId: "cus_test123",
    stripeSubscriptionId: "sub_test123",
    currentPeriodStart: new Date(),
    currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export function createTestSession(overrides: Record<string, unknown> = {}) {
  return {
    id: "test-session-id",
    userId: "test-user-id-123",
    deviceId: "test-device-id",
    originalId: "550e8400-e29b-41d4-a716-446655440001",
    title: "Test Meeting",
    startTime: new Date("2025-06-01T10:00:00Z"),
    endTime: new Date("2025-06-01T11:00:00Z"),
    transcript: "Hello, this is a test transcript.",
    summary: "Test summary",
    actionItems: ["Follow up on X"],
    mode: "Default",
    version: 1,
    checksum: "abc123",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export const VALID_PASSWORD = "TestPass123";
export const WEAK_PASSWORD = "weak";
export const VALID_EMAIL = "test@example.com";
export const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";
export const VALID_USER_CODE = "ABCD-1234";
