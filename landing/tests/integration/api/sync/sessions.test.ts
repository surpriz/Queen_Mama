// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { prismaMock, resetPrismaMock } from "@/tests/helpers/prisma-mock";
import { createTestUser, createTestSubscription, VALID_UUID } from "@/tests/helpers/fixtures";

// Mock device-auth
const mockVerifyAccessToken = vi.fn();
vi.mock("@/lib/device-auth", () => ({
  verifyAccessToken: (...args: unknown[]) => mockVerifyAccessToken(...args),
  AUTH_CONSTANTS: {
    ACCESS_TOKEN_EXPIRY_SECONDS: 900,
    REFRESH_TOKEN_EXPIRY_DAYS: 30,
  },
}));

// Mock knowledge-extraction
vi.mock("@/lib/knowledge-extraction", () => ({
  queueExtractionForSession: vi.fn(),
}));

// Mock validations
vi.mock("@/lib/validations", () => ({
  sessionSyncSchema: {
    safeParse: vi.fn((data: unknown) => {
      const d = data as Record<string, unknown>;
      if (d && d.deviceId && d.originalId && d.title && d.startTime) {
        return { success: true, data: d };
      }
      return { success: false, error: { flatten: () => ({}) } };
    }),
    _output: {} as Record<string, unknown>,
  },
  sessionSyncBatchSchema: {
    safeParse: vi.fn((data: unknown) => {
      const d = data as { sessions?: unknown[] };
      if (d && d.sessions && Array.isArray(d.sessions)) {
        return { success: true, data: { sessions: d.sessions } };
      }
      return { success: false, error: { flatten: () => ({}) } };
    }),
  },
}));

import { POST, GET } from "@/app/api/sync/sessions/route";

function makePostRequest(body: unknown, token = "valid-access-token"): Request {
  return new Request("http://localhost:3000/api/sync/sessions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
}

function makeGetRequest(params: Record<string, string> = {}, token = "valid-access-token"): Request {
  const searchParams = new URLSearchParams(params);
  return new Request(
    `http://localhost:3000/api/sync/sessions?${searchParams.toString()}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
}

describe("/api/sync/sessions", () => {
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
  // POST - Auth checks
  // =========================================
  describe("POST /api/sync/sessions - Authentication", () => {
    it("should return 401 if Authorization header is missing", async () => {
      const req = new Request("http://localhost:3000/api/sync/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.error).toBe("unauthorized");
    });

    it("should return 401 if access token is invalid", async () => {
      mockVerifyAccessToken.mockRejectedValue(new Error("Invalid token"));

      const res = await POST(makePostRequest({}, "bad-token"));
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.error).toBe("invalid_token");
    });

    it("should return 404 if user is not found", async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      const res = await POST(
        makePostRequest({
          deviceId: VALID_UUID,
          originalId: "550e8400-e29b-41d4-a716-446655440001",
          title: "Test",
          startTime: new Date().toISOString(),
        })
      );
      const json = await res.json();

      expect(res.status).toBe(404);
      expect(json.error).toBe("user_not_found");
    });

    it("should return 403 if user is blocked", async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        ...createTestUser({ role: "BLOCKED" }),
        subscription: null,
      } as never);

      const res = await POST(
        makePostRequest({
          deviceId: VALID_UUID,
          originalId: "550e8400-e29b-41d4-a716-446655440001",
          title: "Test",
          startTime: new Date().toISOString(),
        })
      );
      const json = await res.json();

      expect(res.status).toBe(403);
      expect(json.error).toBe("account_blocked");
    });
  });

  // =========================================
  // POST - Single session sync
  // =========================================
  describe("POST /api/sync/sessions - Single session", () => {
    it("should sync a single session successfully", async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        ...createTestUser(),
        subscription: createTestSubscription(),
      } as never);

      prismaMock.syncedSession.upsert.mockResolvedValue({
        id: "synced-1",
        originalId: "550e8400-e29b-41d4-a716-446655440001",
        userId: "test-user-id-123",
        deviceId: VALID_UUID,
        title: "Test Meeting",
      } as never);

      const res = await POST(
        makePostRequest({
          deviceId: VALID_UUID,
          originalId: "550e8400-e29b-41d4-a716-446655440001",
          title: "Test Meeting",
          startTime: new Date().toISOString(),
        })
      );
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.synced).toBe(1);
      expect(json.failed).toBe(0);
      expect(json.results[0].status).toBe("synced");
    });

    it("should detect device mismatch", async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        ...createTestUser(),
        subscription: null,
      } as never);

      const res = await POST(
        makePostRequest({
          deviceId: "00000000-0000-0000-0000-000000000000", // different from token
          originalId: "550e8400-e29b-41d4-a716-446655440001",
          title: "Test Meeting",
          startTime: new Date().toISOString(),
        })
      );
      const json = await res.json();

      expect(json.failed).toBe(1);
      expect(json.errors[0].error).toBe("device_mismatch");
    });
  });

  // =========================================
  // POST - Batch session sync
  // =========================================
  describe("POST /api/sync/sessions - Batch", () => {
    it("should sync multiple sessions in batch", async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        ...createTestUser(),
        subscription: createTestSubscription(),
      } as never);

      prismaMock.syncedSession.upsert
        .mockResolvedValueOnce({
          id: "synced-1",
          originalId: "550e8400-e29b-41d4-a716-446655440001",
        } as never)
        .mockResolvedValueOnce({
          id: "synced-2",
          originalId: "550e8400-e29b-41d4-a716-446655440002",
        } as never);

      const res = await POST(
        makePostRequest({
          sessions: [
            {
              deviceId: VALID_UUID,
              originalId: "550e8400-e29b-41d4-a716-446655440001",
              title: "Meeting 1",
              startTime: new Date().toISOString(),
            },
            {
              deviceId: VALID_UUID,
              originalId: "550e8400-e29b-41d4-a716-446655440002",
              title: "Meeting 2",
              startTime: new Date().toISOString(),
            },
          ],
        })
      );
      const json = await res.json();

      expect(json.synced).toBe(2);
      expect(json.failed).toBe(0);
    });
  });

  // =========================================
  // POST - AI Responses sync
  // =========================================
  describe("POST /api/sync/sessions - With AI responses", () => {
    it("should sync AI responses along with session", async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        ...createTestUser(),
        subscription: createTestSubscription(),
      } as never);

      prismaMock.syncedSession.upsert.mockResolvedValue({
        id: "synced-1",
        originalId: "550e8400-e29b-41d4-a716-446655440001",
      } as never);

      prismaMock.syncedAIResponse.upsert.mockResolvedValue({} as never);

      const res = await POST(
        makePostRequest({
          deviceId: VALID_UUID,
          originalId: "550e8400-e29b-41d4-a716-446655440001",
          title: "Meeting with AI",
          startTime: new Date().toISOString(),
          aiResponses: [
            {
              originalId: "550e8400-e29b-41d4-a716-446655440099",
              type: "assist",
              content: "Suggestion here",
              provider: "openai",
              latencyMs: 500,
              timestamp: new Date().toISOString(),
            },
          ],
        })
      );
      const json = await res.json();

      expect(json.synced).toBe(1);
      expect(prismaMock.syncedAIResponse.upsert).toHaveBeenCalled();
    });
  });

  // =========================================
  // GET - Fetch synced sessions
  // =========================================
  describe("GET /api/sync/sessions", () => {
    it("should return 401 without auth header", async () => {
      const req = new Request("http://localhost:3000/api/sync/sessions", {
        method: "GET",
      });

      const res = await GET(req);
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.error).toBe("unauthorized");
    });

    it("should return 401 with invalid token", async () => {
      mockVerifyAccessToken.mockRejectedValue(new Error("Invalid"));

      const res = await GET(makeGetRequest({}, "bad-token"));
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.error).toBe("invalid_token");
    });

    it("should return sessions for current device", async () => {
      const sessions = [
        {
          id: "s-1",
          originalId: "orig-1",
          deviceId: VALID_UUID,
          title: "Meeting 1",
          startTime: new Date(),
          version: 1,
          checksum: "abc",
          updatedAt: new Date(),
        },
      ];

      prismaMock.syncedSession.findMany.mockResolvedValue(sessions as never);
      prismaMock.syncedSession.count.mockResolvedValue(1 as never);

      const res = await GET(makeGetRequest());
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.sessions).toHaveLength(1);
      expect(json.total).toBe(1);
    });

    it("should support limit and offset parameters", async () => {
      prismaMock.syncedSession.findMany.mockResolvedValue([] as never);
      prismaMock.syncedSession.count.mockResolvedValue(0 as never);

      const res = await GET(makeGetRequest({ limit: "10", offset: "20" }));
      const json = await res.json();

      expect(json.limit).toBe(10);
      expect(json.offset).toBe(20);
    });
  });

  // =========================================
  // Error handling
  // =========================================
  describe("Error handling", () => {
    it("should return 500 on unexpected POST error", async () => {
      prismaMock.user.findUnique.mockRejectedValue(new Error("DB error"));

      const res = await POST(
        makePostRequest({
          deviceId: VALID_UUID,
          originalId: "550e8400-e29b-41d4-a716-446655440001",
          title: "Test",
          startTime: new Date().toISOString(),
        })
      );
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.error).toBe("server_error");
    });
  });
});
