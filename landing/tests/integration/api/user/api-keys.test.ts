// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { prismaMock, resetPrismaMock } from "@/tests/helpers/prisma-mock";
import {
  mockAuth,
  createMockSession,
} from "@/tests/helpers/auth-mock";

// Mock auth
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
  handlers: { GET: vi.fn(), POST: vi.fn() },
}));

// Mock encryption
vi.mock("@/lib/encryption", () => ({
  encryptApiKey: vi.fn().mockReturnValue("encrypted-key-data"),
  getKeyPrefix: vi.fn().mockReturnValue("sk-t...t456"),
}));

// Mock validations
vi.mock("@/lib/validations", () => ({
  apiKeySchema: {
    safeParse: vi.fn((data: unknown) => {
      const d = data as { provider?: string; apiKey?: string };
      if (d && d.provider && d.apiKey && d.apiKey.length >= 10) {
        return { success: true, data: { provider: d.provider, apiKey: d.apiKey } };
      }
      return {
        success: false,
        error: { issues: [{ message: "Invalid API key" }] },
      };
    }),
  },
}));

import { auth } from "@/lib/auth";
import { GET, POST } from "@/app/api/user/api-keys/route";

const mockedAuth = vi.mocked(auth);

function makePostRequest(body: unknown): Request {
  return new Request("http://localhost:3000/api/user/api-keys", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/user/api-keys", () => {
  beforeEach(() => {
    resetPrismaMock();
    mockedAuth.mockReset();
  });

  // =========================================
  // GET - List API Keys
  // =========================================
  describe("GET /api/user/api-keys", () => {
    it("should return 401 if not authenticated", async () => {
      mockedAuth.mockResolvedValue(null as never);

      const res = await GET();
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.error).toBe("Unauthorized");
    });

    it("should return user API keys when authenticated", async () => {
      mockedAuth.mockResolvedValue(createMockSession() as never);

      const mockKeys = [
        {
          id: "key-1",
          provider: "OPENAI",
          keyPrefix: "sk-t...st12",
          isActive: true,
          createdAt: new Date(),
          lastUsedAt: null,
        },
        {
          id: "key-2",
          provider: "ANTHROPIC",
          keyPrefix: "sk-a...bc34",
          isActive: true,
          createdAt: new Date(),
          lastUsedAt: new Date(),
        },
      ];

      prismaMock.apiKey.findMany.mockResolvedValue(mockKeys as never);

      const res = await GET();
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json).toHaveLength(2);
      expect(json[0].provider).toBe("OPENAI");
      expect(json[1].provider).toBe("ANTHROPIC");
      // Should NOT include the actual key hash
      expect(json[0].keyHash).toBeUndefined();
    });

    it("should query with the correct userId", async () => {
      const session = createMockSession({ id: "custom-user-id" });
      mockedAuth.mockResolvedValue(session as never);
      prismaMock.apiKey.findMany.mockResolvedValue([] as never);

      await GET();

      expect(prismaMock.apiKey.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: "custom-user-id" },
        })
      );
    });
  });

  // =========================================
  // POST - Create API Key
  // =========================================
  describe("POST /api/user/api-keys", () => {
    it("should return 401 if not authenticated", async () => {
      mockedAuth.mockResolvedValue(null as never);

      const res = await POST(
        makePostRequest({ provider: "OPENAI", apiKey: "sk-test12345678" })
      );
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.error).toBe("Unauthorized");
    });

    it("should return 400 for invalid input", async () => {
      mockedAuth.mockResolvedValue(createMockSession() as never);

      const res = await POST(
        makePostRequest({ provider: "INVALID", apiKey: "short" })
      );
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toBeDefined();
    });

    it("should return 400 if a key for this provider already exists", async () => {
      mockedAuth.mockResolvedValue(createMockSession() as never);
      prismaMock.apiKey.findUnique.mockResolvedValue({
        id: "existing-key",
        provider: "OPENAI",
      } as never);

      const res = await POST(
        makePostRequest({ provider: "OPENAI", apiKey: "sk-test12345678" })
      );
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toContain("already exists");
    });

    it("should create API key with encryption on success", async () => {
      mockedAuth.mockResolvedValue(createMockSession() as never);
      prismaMock.apiKey.findUnique.mockResolvedValue(null);
      prismaMock.apiKey.create.mockResolvedValue({
        id: "new-key-id",
        provider: "OPENAI",
        keyPrefix: "sk-t...t456",
        isActive: true,
        createdAt: new Date(),
      } as never);

      const res = await POST(
        makePostRequest({ provider: "OPENAI", apiKey: "sk-test12345678" })
      );
      const json = await res.json();

      expect(res.status).toBe(201);
      expect(json.id).toBe("new-key-id");
      expect(json.provider).toBe("OPENAI");
      expect(json.keyPrefix).toBe("sk-t...t456");
      expect(json.isActive).toBe(true);
    });

    it("should store encrypted key hash, not plaintext", async () => {
      mockedAuth.mockResolvedValue(createMockSession() as never);
      prismaMock.apiKey.findUnique.mockResolvedValue(null);
      prismaMock.apiKey.create.mockResolvedValue({
        id: "key-id",
        provider: "ANTHROPIC",
        keyPrefix: "sk-a...nt56",
        isActive: true,
        createdAt: new Date(),
      } as never);

      await POST(
        makePostRequest({ provider: "ANTHROPIC", apiKey: "sk-ant-test12345" })
      );

      expect(prismaMock.apiKey.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            keyHash: "encrypted-key-data", // from mocked encryptApiKey
            keyPrefix: "sk-t...t456",
          }),
        })
      );
    });

    it("should return 500 on server error", async () => {
      mockedAuth.mockResolvedValue(createMockSession() as never);
      prismaMock.apiKey.findUnique.mockResolvedValue(null);
      prismaMock.apiKey.create.mockRejectedValue(new Error("DB error"));

      const res = await POST(
        makePostRequest({ provider: "OPENAI", apiKey: "sk-test12345678" })
      );
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.error).toContain("Failed to create");
    });
  });
});
