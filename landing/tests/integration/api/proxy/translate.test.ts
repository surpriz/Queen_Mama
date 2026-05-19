// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { prismaMock, resetPrismaMock } from "@/tests/helpers/prisma-mock";
import { createTestUser, createTestSubscription, VALID_UUID } from "@/tests/helpers/fixtures";

// Mock device-auth
const mockVerifyAccessToken = vi.fn();
vi.mock("@/lib/device-auth", () => ({
  verifyAccessToken: (...args: unknown[]) => mockVerifyAccessToken(...args),
}));

// Mock provider key lookup
const mockGetProviderApiKey = vi.fn();
vi.mock("@/lib/ai-providers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai-providers")>();
  return {
    ...actual,
    getProviderApiKey: (...args: unknown[]) => mockGetProviderApiKey(...args),
  };
});

import { POST } from "@/app/api/proxy/translate/route";

function makeRequest(body: unknown, token: string | null = "valid-token"): Request {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return new Request("http://localhost:3000/api/proxy/translate", {
    method: "POST",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const tokenPayload = {
  sub: "test-user-id-123",
  email: "test@example.com",
  name: "Test User",
  role: "USER",
  deviceId: VALID_UUID,
};

const originalFetch = global.fetch;

describe("POST /api/proxy/translate", () => {
  beforeEach(() => {
    resetPrismaMock();
    mockVerifyAccessToken.mockReset();
    mockGetProviderApiKey.mockReset();
    mockVerifyAccessToken.mockResolvedValue(tokenPayload);
    mockGetProviderApiKey.mockResolvedValue("deepl-key:fx");
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("returns 401 when Authorization header is missing", async () => {
    const res = await POST(makeRequest({ text: "Hi", target_lang: "FR" }, null));
    expect(res.status).toBe(401);
  });

  it("returns 401 when access token is invalid", async () => {
    mockVerifyAccessToken.mockRejectedValueOnce(new Error("bad token"));
    const res = await POST(makeRequest({ text: "Hi", target_lang: "FR" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when text is missing", async () => {
    const res = await POST(makeRequest({ target_lang: "FR" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("missing_text");
  });

  it("returns 400 when target_lang is missing", async () => {
    const res = await POST(makeRequest({ text: "Hi" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("missing_target_lang");
  });

  it("returns 400 when text exceeds 5000 chars", async () => {
    const huge = "a".repeat(5001);
    const res = await POST(makeRequest({ text: huge, target_lang: "FR" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("text_too_long");
  });

  it("returns 403 when user plan is FREE (no translation)", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      ...createTestUser(),
      subscription: createTestSubscription({ plan: "FREE" }),
    } as never);

    const res = await POST(makeRequest({ text: "Bonjour", target_lang: "EN-US" }));
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toBe("translation_not_available");
  });

  it("returns 403 when user is BLOCKED", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      ...createTestUser({ role: "BLOCKED" }),
      subscription: createTestSubscription({ plan: "PRO" }),
    } as never);

    const res = await POST(makeRequest({ text: "Bonjour", target_lang: "EN-US" }));
    expect(res.status).toBe(403);
  });

  it("returns 503 when DeepL key is not configured", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      ...createTestUser(),
      subscription: createTestSubscription({ plan: "PRO" }),
    } as never);
    prismaMock.usageLog.aggregate.mockResolvedValue({ _sum: { tokensUsed: 0 } } as never);
    mockGetProviderApiKey.mockResolvedValueOnce(null);

    const res = await POST(makeRequest({ text: "Bonjour", target_lang: "EN-US" }));
    expect(res.status).toBe(503);
  });

  it("returns 402 when monthly quota is exhausted on PRO", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      ...createTestUser(),
      subscription: createTestSubscription({ plan: "PRO" }),
    } as never);
    prismaMock.usageLog.aggregate.mockResolvedValue({ _sum: { tokensUsed: 500_000 } } as never);

    const res = await POST(makeRequest({ text: "Bonjour", target_lang: "EN-US" }));
    expect(res.status).toBe(402);
    const json = await res.json();
    expect(json.error).toBe("quota_exceeded");
  });

  it("returns 429 when DeepL returns rate limit", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      ...createTestUser(),
      subscription: createTestSubscription({ plan: "PRO" }),
    } as never);
    prismaMock.usageLog.aggregate.mockResolvedValue({ _sum: { tokensUsed: 0 } } as never);

    global.fetch = vi.fn().mockResolvedValueOnce(new Response("", { status: 429 }));

    const res = await POST(makeRequest({ text: "Bonjour", target_lang: "EN-US" }));
    expect(res.status).toBe(429);
  });

  it("returns 402 when DeepL returns 456 (quota exhausted server-side)", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      ...createTestUser(),
      subscription: createTestSubscription({ plan: "PRO" }),
    } as never);
    prismaMock.usageLog.aggregate.mockResolvedValue({ _sum: { tokensUsed: 0 } } as never);

    global.fetch = vi.fn().mockResolvedValueOnce(new Response("", { status: 456 }));

    const res = await POST(makeRequest({ text: "Bonjour", target_lang: "EN-US" }));
    expect(res.status).toBe(402);
  });

  it("returns translated text on successful DeepL call", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      ...createTestUser(),
      subscription: createTestSubscription({ plan: "PRO" }),
    } as never);
    prismaMock.usageLog.aggregate.mockResolvedValue({ _sum: { tokensUsed: 0 } } as never);
    prismaMock.usageLog.create.mockResolvedValue({} as never);

    global.fetch = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          translations: [{ detected_source_language: "FR", text: "Hello how are you" }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const res = await POST(makeRequest({ text: "Bonjour comment allez-vous", target_lang: "EN-US" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.translated_text).toBe("Hello how are you");
    expect(json.detected_source_lang).toBe("FR");
    expect(json.target_lang).toBe("EN-US");
  });

  it("forwards source_lang to DeepL when provided", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      ...createTestUser(),
      subscription: createTestSubscription({ plan: "PRO" }),
    } as never);
    prismaMock.usageLog.aggregate.mockResolvedValue({ _sum: { tokensUsed: 0 } } as never);
    prismaMock.usageLog.create.mockResolvedValue({} as never);

    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({ translations: [{ text: "Hello" }] }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    global.fetch = fetchMock;

    await POST(makeRequest({ text: "Bonjour", target_lang: "EN-US", source_lang: "FR" }));

    const callBody = (fetchMock.mock.calls[0][1] as { body: string }).body;
    expect(callBody).toContain("source_lang=FR");
    expect(callBody).toContain("target_lang=EN-US");
  });

  it("skips source_lang param when AUTO is passed", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      ...createTestUser(),
      subscription: createTestSubscription({ plan: "PRO" }),
    } as never);
    prismaMock.usageLog.aggregate.mockResolvedValue({ _sum: { tokensUsed: 0 } } as never);
    prismaMock.usageLog.create.mockResolvedValue({} as never);

    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({ translations: [{ text: "Hello" }] }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    global.fetch = fetchMock;

    await POST(makeRequest({ text: "Bonjour", target_lang: "EN-US", source_lang: "auto" }));

    const callBody = (fetchMock.mock.calls[0][1] as { body: string }).body;
    expect(callBody).not.toContain("source_lang");
  });

  it("uses api.deepl.com endpoint for Pro keys (no :fx suffix)", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      ...createTestUser(),
      subscription: createTestSubscription({ plan: "PRO" }),
    } as never);
    prismaMock.usageLog.aggregate.mockResolvedValue({ _sum: { tokensUsed: 0 } } as never);
    prismaMock.usageLog.create.mockResolvedValue({} as never);
    mockGetProviderApiKey.mockResolvedValueOnce("pro-key-no-suffix");

    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({ translations: [{ text: "Hello" }] }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    global.fetch = fetchMock;

    await POST(makeRequest({ text: "Bonjour", target_lang: "EN-US" }));

    expect(fetchMock.mock.calls[0][0]).toBe("https://api.deepl.com/v2/translate");
  });

  it("forwards context to DeepL when provided", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      ...createTestUser(),
      subscription: createTestSubscription({ plan: "PRO" }),
    } as never);
    prismaMock.usageLog.aggregate.mockResolvedValue({ _sum: { tokensUsed: 0 } } as never);
    prismaMock.usageLog.create.mockResolvedValue({} as never);

    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({ translations: [{ text: "Hello" }] }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    global.fetch = fetchMock;

    await POST(makeRequest({
      text: "Bonjour",
      target_lang: "EN-US",
      context: "Andrew est génial.",
    }));

    const callBody = (fetchMock.mock.calls[0][1] as { body: string }).body;
    expect(callBody).toContain("context=Andrew");
  });

  it("rejects context exceeding 10000 chars", async () => {
    const huge = "a".repeat(10_001);
    const res = await POST(makeRequest({
      text: "Bonjour",
      target_lang: "EN-US",
      context: huge,
    }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("context_too_long");
  });

  it("omits context param when not provided", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      ...createTestUser(),
      subscription: createTestSubscription({ plan: "PRO" }),
    } as never);
    prismaMock.usageLog.aggregate.mockResolvedValue({ _sum: { tokensUsed: 0 } } as never);
    prismaMock.usageLog.create.mockResolvedValue({} as never);

    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({ translations: [{ text: "Hello" }] }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    global.fetch = fetchMock;

    await POST(makeRequest({ text: "Bonjour", target_lang: "EN-US" }));

    const callBody = (fetchMock.mock.calls[0][1] as { body: string }).body;
    expect(callBody).not.toContain("context=");
  });

  it("ENTERPRISE plan has unlimited quota (skips aggregation)", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      ...createTestUser(),
      subscription: createTestSubscription({ plan: "ENTERPRISE" }),
    } as never);
    prismaMock.usageLog.create.mockResolvedValue({} as never);

    global.fetch = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({ translations: [{ text: "Hello" }] }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const res = await POST(makeRequest({ text: "Bonjour", target_lang: "EN-US" }));
    expect(res.status).toBe(200);
    expect(prismaMock.usageLog.aggregate).not.toHaveBeenCalled();
  });
});
