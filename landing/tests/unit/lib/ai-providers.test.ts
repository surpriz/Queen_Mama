// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock admin-keys before importing ai-providers
vi.mock("@/lib/admin-keys", () => ({
  getAdminApiKey: vi.fn(),
  getConfiguredProviders: vi.fn(),
  toApiKeyProvider: vi.fn((p: string) => p.toUpperCase()),
}));

import {
  buildOpenAIRequestBody,
  buildAnthropicRequestBody,
  buildGeminiRequestBody,
  canUseSmartMode,
  getMaxTokens,
  getModelForProvider,
  validateAIRequest,
  getAvailableAIProviders,
  getAvailableTranscriptionProviders,
  getModelCascade,
  TIER_LIMITS,
  AI_MODELS,
  MODEL_CASCADE,
  PROVIDER_URLS,
} from "@/lib/ai-providers";

import { getAdminApiKey, getConfiguredProviders } from "@/lib/admin-keys";

const mockedGetAdminApiKey = vi.mocked(getAdminApiKey);
const mockedGetConfiguredProviders = vi.mocked(getConfiguredProviders);

describe("ai-providers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================
  // buildOpenAIRequestBody
  // =========================================
  describe("buildOpenAIRequestBody", () => {
    it("should build standard body with max_tokens for legacy models", () => {
      const body = buildOpenAIRequestBody({
        model: "gpt-4o",
        messages: [{ role: "user", content: "Hello" }],
        maxTokens: 4000,
        stream: true,
      }) as Record<string, unknown>;

      expect(body.model).toBe("gpt-4o");
      expect(body.max_tokens).toBe(4000);
      expect(body.max_completion_tokens).toBeUndefined();
      expect(body.stream).toBe(true);
      expect(body.temperature).toBe(0.7);
    });

    it("should use max_completion_tokens for o4-* models", () => {
      const body = buildOpenAIRequestBody({
        model: "o4-mini",
        messages: [{ role: "user", content: "Hello" }],
        maxTokens: 4000,
        stream: false,
      }) as Record<string, unknown>;

      expect(body.max_completion_tokens).toBe(4000);
      expect(body.max_tokens).toBeUndefined();
    });

    it("should use max_completion_tokens for gpt-5-* models", () => {
      const body = buildOpenAIRequestBody({
        model: "gpt-5-turbo",
        messages: [{ role: "user", content: "Hello" }],
        maxTokens: 8000,
        stream: true,
      }) as Record<string, unknown>;

      expect(body.max_completion_tokens).toBe(8000);
      expect(body.max_tokens).toBeUndefined();
    });

    it("should omit temperature for gpt-5-* models", () => {
      const body = buildOpenAIRequestBody({
        model: "gpt-5-turbo",
        messages: [{ role: "user", content: "Hello" }],
        maxTokens: 8000,
        stream: true,
      }) as Record<string, unknown>;

      expect(body.temperature).toBeUndefined();
    });

    it("should use max_completion_tokens for gpt-4.1-* models", () => {
      const body = buildOpenAIRequestBody({
        model: "gpt-4.1-turbo",
        messages: [{ role: "user", content: "Hello" }],
        maxTokens: 2000,
        stream: false,
      }) as Record<string, unknown>;

      expect(body.max_completion_tokens).toBe(2000);
      expect(body.max_tokens).toBeUndefined();
    });

    it("should allow custom temperature", () => {
      const body = buildOpenAIRequestBody({
        model: "gpt-4o",
        messages: [{ role: "user", content: "Hello" }],
        maxTokens: 1000,
        stream: false,
        temperature: 0.3,
      }) as Record<string, unknown>;

      expect(body.temperature).toBe(0.3);
    });

    it("should include messages in body", () => {
      const messages = [
        { role: "system", content: "You are helpful." },
        { role: "user", content: "Hello" },
      ];
      const body = buildOpenAIRequestBody({
        model: "gpt-4o",
        messages,
        maxTokens: 1000,
        stream: false,
      }) as Record<string, unknown>;

      expect(body.messages).toEqual(messages);
    });
  });

  // =========================================
  // buildAnthropicRequestBody
  // =========================================
  describe("buildAnthropicRequestBody", () => {
    it("should build standard body without thinking", () => {
      const body = buildAnthropicRequestBody({
        model: "claude-sonnet-4-6",
        systemPrompt: "Be helpful",
        messages: [{ role: "user", content: "Hello" }],
        maxTokens: 4000,
        stream: true,
        smartMode: false,
      }) as Record<string, unknown>;

      expect(body.model).toBe("claude-sonnet-4-6");
      expect(body.system).toBe("Be helpful");
      expect(body.max_tokens).toBe(4000);
      expect(body.stream).toBe(true);
      expect(body.thinking).toBeUndefined();
    });

    it("should enable adaptive thinking in smart mode", () => {
      const body = buildAnthropicRequestBody({
        model: "claude-sonnet-4-6",
        systemPrompt: "Be helpful",
        messages: [{ role: "user", content: "Think deeply" }],
        maxTokens: 4000,
        stream: true,
        smartMode: true,
      }) as Record<string, unknown>;

      expect(body.thinking).toEqual({
        type: "adaptive",
      });
    });

    it("should use 16000 budget_tokens in recap mode", () => {
      const body = buildAnthropicRequestBody({
        model: "claude-sonnet-4-6",
        systemPrompt: "Summarize",
        messages: [{ role: "user", content: "Recap" }],
        maxTokens: 4000,
        stream: false,
        smartMode: false,
        mode: "recap",
      }) as Record<string, unknown>;

      expect(body.thinking).toEqual({
        type: "enabled",
        budget_tokens: 16000,
      });
    });

    it("should enable adaptive thinking when mode is 'smart' even if smartMode is false", () => {
      const body = buildAnthropicRequestBody({
        model: "claude-sonnet-4-6",
        systemPrompt: "Be helpful",
        messages: [{ role: "user", content: "Analyze" }],
        maxTokens: 4000,
        stream: false,
        smartMode: false,
        mode: "smart",
      }) as Record<string, unknown>;

      expect(body.thinking).toEqual({
        type: "adaptive",
      });
    });

    it("should prioritize recap mode over smart mode", () => {
      const body = buildAnthropicRequestBody({
        model: "claude-sonnet-4-6",
        systemPrompt: "Summarize",
        messages: [{ role: "user", content: "Recap" }],
        maxTokens: 4000,
        stream: false,
        smartMode: true,
        mode: "recap",
      }) as Record<string, unknown>;

      // Recap takes priority: 16000 budget
      expect(body.thinking).toEqual({
        type: "enabled",
        budget_tokens: 16000,
      });
    });
  });

  // =========================================
  // buildGeminiRequestBody
  // =========================================
  describe("buildGeminiRequestBody", () => {
    it("should build Gemini request body", () => {
      const contents = [
        { role: "user", parts: [{ text: "Hello" }] },
      ];
      const body = buildGeminiRequestBody({
        contents,
        maxTokens: 2000,
      }) as Record<string, unknown>;

      expect(body.contents).toEqual(contents);
      expect(body.generationConfig).toEqual({
        maxOutputTokens: 2000,
        temperature: 0.7,
      });
    });
  });

  // =========================================
  // Tier Limits
  // =========================================
  describe("TIER_LIMITS", () => {
    it("FREE tier should have limited tokens and no smart mode", () => {
      expect(TIER_LIMITS.FREE.maxTokens).toBe(1000);
      expect(TIER_LIMITS.FREE.smartMode).toBe(false);
      expect(TIER_LIMITS.FREE.dailyAiRequests).toBe(10);
      expect(TIER_LIMITS.FREE.screenshot).toBe(false);
    });

    it("PRO tier should have higher token limit but no smart mode", () => {
      expect(TIER_LIMITS.PRO.maxTokens).toBe(4000);
      expect(TIER_LIMITS.PRO.smartMode).toBe(false);
      expect(TIER_LIMITS.PRO.dailyAiRequests).toBeNull();
      expect(TIER_LIMITS.PRO.screenshot).toBe(true);
    });

    it("ENTERPRISE tier should have highest limits and smart mode", () => {
      expect(TIER_LIMITS.ENTERPRISE.maxTokens).toBe(16000);
      expect(TIER_LIMITS.ENTERPRISE.smartMode).toBe(true);
      expect(TIER_LIMITS.ENTERPRISE.dailyAiRequests).toBeNull();
      expect(TIER_LIMITS.ENTERPRISE.screenshot).toBe(true);
    });
  });

  // =========================================
  // canUseSmartMode
  // =========================================
  describe("canUseSmartMode", () => {
    it("should return false for FREE tier", () => {
      expect(canUseSmartMode("FREE")).toBe(false);
    });

    it("should return false for PRO tier", () => {
      expect(canUseSmartMode("PRO")).toBe(false);
    });

    it("should return true for ENTERPRISE tier", () => {
      expect(canUseSmartMode("ENTERPRISE")).toBe(true);
    });
  });

  // =========================================
  // getMaxTokens
  // =========================================
  describe("getMaxTokens", () => {
    it("should return 1000 for FREE", () => {
      expect(getMaxTokens("FREE")).toBe(1000);
    });

    it("should return 4000 for PRO", () => {
      expect(getMaxTokens("PRO")).toBe(4000);
    });

    it("should return 16000 for ENTERPRISE", () => {
      expect(getMaxTokens("ENTERPRISE")).toBe(16000);
    });
  });

  // =========================================
  // getModelForProvider
  // =========================================
  describe("getModelForProvider", () => {
    it("should return standard model when smartMode is false", () => {
      expect(getModelForProvider("openai", false)).toBe("gpt-4o");
      expect(getModelForProvider("anthropic", false)).toBe("claude-sonnet-4-6");
      expect(getModelForProvider("gemini", false)).toBe("gemini-2.0-flash");
    });

    it("should return smart model when smartMode is true", () => {
      expect(getModelForProvider("openai", true)).toBe("o4-mini");
      expect(getModelForProvider("anthropic", true)).toBe("claude-sonnet-4-6");
      expect(getModelForProvider("gemini", true)).toBe("gemini-2.0-flash-thinking-exp");
    });
  });

  // =========================================
  // getModelCascade
  // =========================================
  describe("getModelCascade", () => {
    it("should return standard cascade for false (legacy boolean)", async () => {
      mockedGetConfiguredProviders.mockResolvedValue(["ANTHROPIC", "OPENAI"] as never);

      const cascade = await getModelCascade(false);
      expect(cascade.length).toBeGreaterThan(0);
      expect(cascade[0].provider).toBe("anthropic");
    });

    it("should return smart cascade for true (legacy boolean)", async () => {
      mockedGetConfiguredProviders.mockResolvedValue(["ANTHROPIC", "OPENAI"] as never);

      const cascade = await getModelCascade(true);
      expect(cascade.length).toBeGreaterThan(0);
    });

    it("should filter cascade by configured providers", async () => {
      mockedGetConfiguredProviders.mockResolvedValue(["OPENAI"] as never);

      const cascade = await getModelCascade("standard");
      // Should only include openai entries
      cascade.forEach((item) => {
        expect(item.provider).toBe("openai");
      });
    });

    it("should return empty if no providers configured", async () => {
      mockedGetConfiguredProviders.mockResolvedValue([] as never);

      const cascade = await getModelCascade("standard");
      expect(cascade).toHaveLength(0);
    });

    it("should accept 'recap' mode string", async () => {
      mockedGetConfiguredProviders.mockResolvedValue(["ANTHROPIC", "OPENAI"] as never);

      const cascade = await getModelCascade("recap");
      expect(cascade.length).toBeGreaterThan(0);
    });
  });

  // =========================================
  // validateAIRequest
  // =========================================
  describe("validateAIRequest", () => {
    it("should return valid for PRO tier with configured provider", async () => {
      mockedGetAdminApiKey.mockResolvedValue("sk-test-key");

      const result = await validateAIRequest({
        tier: "PRO",
        provider: "openai",
        smartMode: false,
        dailyRequestCount: 0,
      });

      expect(result.valid).toBe(true);
      expect(result.maxTokens).toBe(4000);
      expect(result.model).toBe("gpt-4o");
    });

    it("should reject smart mode for non-ENTERPRISE tiers", async () => {
      const result = await validateAIRequest({
        tier: "PRO",
        provider: "openai",
        smartMode: true,
        dailyRequestCount: 0,
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain("Smart Mode requires Enterprise");
    });

    it("should allow smart mode for ENTERPRISE tier", async () => {
      mockedGetAdminApiKey.mockResolvedValue("sk-test-key");

      const result = await validateAIRequest({
        tier: "ENTERPRISE",
        provider: "openai",
        smartMode: true,
        dailyRequestCount: 0,
      });

      expect(result.valid).toBe(true);
    });

    it("should reject when daily limit is reached for FREE tier", async () => {
      const result = await validateAIRequest({
        tier: "FREE",
        provider: "openai",
        smartMode: false,
        dailyRequestCount: 10,
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain("Daily AI request limit reached");
    });

    it("should not enforce daily limit for PRO tier (unlimited)", async () => {
      mockedGetAdminApiKey.mockResolvedValue("sk-test-key");

      const result = await validateAIRequest({
        tier: "PRO",
        provider: "openai",
        smartMode: false,
        dailyRequestCount: 999,
      });

      expect(result.valid).toBe(true);
    });

    it("should reject unconfigured provider", async () => {
      mockedGetAdminApiKey.mockResolvedValue(null);

      const result = await validateAIRequest({
        tier: "PRO",
        provider: "openai",
        smartMode: false,
        dailyRequestCount: 0,
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain("not configured");
    });
  });

  // =========================================
  // getAvailableAIProviders
  // =========================================
  describe("getAvailableAIProviders", () => {
    it("should filter by configured providers", async () => {
      mockedGetConfiguredProviders.mockResolvedValue(["OPENAI", "ANTHROPIC"] as never);

      const providers = await getAvailableAIProviders("PRO");
      expect(providers).toContain("openai");
      expect(providers).toContain("anthropic");
    });

    it("should return empty when no providers configured", async () => {
      mockedGetConfiguredProviders.mockResolvedValue([] as never);

      const providers = await getAvailableAIProviders("PRO");
      expect(providers).toHaveLength(0);
    });
  });

  // =========================================
  // getAvailableTranscriptionProviders
  // =========================================
  describe("getAvailableTranscriptionProviders", () => {
    it("should return only deepgram for FREE tier when configured", async () => {
      mockedGetConfiguredProviders.mockResolvedValue(["DEEPGRAM", "ASSEMBLYAI"] as never);

      const providers = await getAvailableTranscriptionProviders("FREE");
      expect(providers).toContain("deepgram");
      expect(providers).not.toContain("assemblyai");
    });

    it("should return both for PRO tier when configured", async () => {
      mockedGetConfiguredProviders.mockResolvedValue(["DEEPGRAM", "ASSEMBLYAI"] as never);

      const providers = await getAvailableTranscriptionProviders("PRO");
      expect(providers).toContain("deepgram");
      expect(providers).toContain("assemblyai");
    });
  });

  // =========================================
  // Constants
  // =========================================
  describe("PROVIDER_URLS", () => {
    it("should have URLs for all providers", () => {
      expect(PROVIDER_URLS.openai).toContain("openai.com");
      expect(PROVIDER_URLS.anthropic).toContain("anthropic.com");
      expect(PROVIDER_URLS.gemini).toContain("googleapis.com");
      expect(PROVIDER_URLS.grok).toContain("x.ai");
    });
  });

  describe("MODEL_CASCADE", () => {
    it("should have standard, smart, and recap cascades", () => {
      expect(MODEL_CASCADE.standard.length).toBeGreaterThan(0);
      expect(MODEL_CASCADE.smart.length).toBeGreaterThan(0);
      expect(MODEL_CASCADE.recap.length).toBeGreaterThan(0);
    });
  });
});
