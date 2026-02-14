import { vi } from "vitest";

// Types matching NextAuth session
export interface MockSession {
  user: {
    id: string;
    email: string;
    name: string | null;
    role: string;
    image?: string | null;
  };
  expires: string;
}

// Factory for creating mock sessions
export function createMockSession(
  overrides: Partial<MockSession["user"]> = {}
): MockSession {
  return {
    user: {
      id: "test-user-id",
      email: "test@example.com",
      name: "Test User",
      role: "USER",
      ...overrides,
    },
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  };
}

export function createAdminSession(): MockSession {
  return createMockSession({ role: "ADMIN", name: "Admin User" });
}

// Mock auth() function
export const mockAuth = vi.fn<() => Promise<MockSession | null>>();

export function setupAuthMock(session: MockSession | null = null) {
  mockAuth.mockResolvedValue(session);
  vi.mock("@/lib/auth", () => ({
    auth: mockAuth,
    handlers: { GET: vi.fn(), POST: vi.fn() },
  }));
}

export function resetAuthMock() {
  mockAuth.mockReset();
}
