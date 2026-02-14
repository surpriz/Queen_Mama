import { describe, it, expect, beforeEach } from "vitest";
import {
  checkRateLimit,
  getIdentifier,
  rateLimitConfigs,
  checkRateLimitMiddleware,
} from "@/lib/rate-limit";

describe("checkRateLimit", () => {
  // Use unique identifiers per test to avoid state leaks
  let testId = 0;
  beforeEach(() => {
    testId++;
  });

  it("allows first request", () => {
    const result = checkRateLimit(`test-first-${testId}`, {
      maxRequests: 10,
      windowSeconds: 60,
    });
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(9);
  });

  it("counts down remaining requests", () => {
    const id = `test-count-${testId}`;
    const config = { maxRequests: 5, windowSeconds: 60 };

    checkRateLimit(id, config); // 1st
    checkRateLimit(id, config); // 2nd
    const result = checkRateLimit(id, config); // 3rd

    expect(result.success).toBe(true);
    expect(result.remaining).toBe(2);
  });

  it("blocks when limit exceeded", () => {
    const id = `test-block-${testId}`;
    const config = { maxRequests: 3, windowSeconds: 60 };

    checkRateLimit(id, config); // 1
    checkRateLimit(id, config); // 2
    checkRateLimit(id, config); // 3 (limit)

    const blocked = checkRateLimit(id, config); // 4 (over limit)
    expect(blocked.success).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfter).toBeGreaterThan(0);
  });

  it("provides retryAfter in seconds", () => {
    const id = `test-retry-${testId}`;
    const config = { maxRequests: 1, windowSeconds: 30 };

    checkRateLimit(id, config); // use up limit
    const result = checkRateLimit(id, config); // blocked

    expect(result.retryAfter).toBeLessThanOrEqual(30);
    expect(result.retryAfter).toBeGreaterThan(0);
  });

  it("resets after window expires", () => {
    const id = `test-reset-${testId}`;
    // Use a very short window that expires immediately
    const config = { maxRequests: 1, windowSeconds: 0 };

    checkRateLimit(id, config); // 1st request
    // Since window is 0 seconds, next check should start a new window
    const result = checkRateLimit(id, config);
    expect(result.success).toBe(true);
  });

  it("sets resetAt timestamp in the future", () => {
    const result = checkRateLimit(`test-resetAt-${testId}`, {
      maxRequests: 10,
      windowSeconds: 60,
    });
    expect(result.resetAt).toBeGreaterThan(Date.now());
  });
});

describe("getIdentifier", () => {
  it("returns user-prefixed identifier when userId provided", () => {
    const req = new Request("http://localhost:3000/api/test");
    const id = getIdentifier(req, "user-123");
    expect(id).toBe("user:user-123");
  });

  it("returns ip-prefixed identifier from x-forwarded-for", () => {
    const req = new Request("http://localhost:3000/api/test", {
      headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" },
    });
    const id = getIdentifier(req);
    expect(id).toBe("ip:1.2.3.4");
  });

  it("returns ip-prefixed identifier from x-real-ip", () => {
    const req = new Request("http://localhost:3000/api/test", {
      headers: { "x-real-ip": "10.0.0.1" },
    });
    const id = getIdentifier(req);
    expect(id).toBe("ip:10.0.0.1");
  });

  it("returns unknown for no IP headers", () => {
    const req = new Request("http://localhost:3000/api/test");
    const id = getIdentifier(req);
    expect(id).toBe("ip:unknown");
  });

  it("prefers userId over IP", () => {
    const req = new Request("http://localhost:3000/api/test", {
      headers: { "x-forwarded-for": "1.2.3.4" },
    });
    const id = getIdentifier(req, "user-456");
    expect(id).toBe("user:user-456");
  });
});

describe("rateLimitConfigs", () => {
  it("standard allows 100 per minute", () => {
    expect(rateLimitConfigs.standard.maxRequests).toBe(100);
    expect(rateLimitConfigs.standard.windowSeconds).toBe(60);
  });

  it("auth is stricter (10 per minute)", () => {
    expect(rateLimitConfigs.auth.maxRequests).toBe(10);
  });

  it("passwordReset is most strict (5 per 5 min)", () => {
    expect(rateLimitConfigs.passwordReset.maxRequests).toBe(5);
    expect(rateLimitConfigs.passwordReset.windowSeconds).toBe(300);
  });

  it("aiProxy has authenticated override", () => {
    expect(rateLimitConfigs.aiProxy.maxRequests).toBe(30);
    expect(rateLimitConfigs.aiProxy.authenticatedMaxRequests).toBe(100);
  });

  it("webhook allows most (200 per minute)", () => {
    expect(rateLimitConfigs.webhook.maxRequests).toBe(200);
  });
});

describe("checkRateLimitMiddleware", () => {
  let midTestId = 0;
  beforeEach(() => {
    midTestId++;
  });

  it("uses auth config for auth routes", () => {
    const result = checkRateLimitMiddleware(`mid-${midTestId}`, "/api/auth/signin");
    // Should use auth config (10/min)
    expect(result.remaining).toBe(9); // 10 - 1
  });

  it("uses aiProxy config for AI proxy routes", () => {
    const result = checkRateLimitMiddleware(`mid-ai-${midTestId}`, "/api/proxy/ai/stream");
    expect(result.remaining).toBe(29); // 30 - 1
  });

  it("uses webhook config for billing webhook", () => {
    const result = checkRateLimitMiddleware(`mid-wh-${midTestId}`, "/api/billing/webhook");
    expect(result.remaining).toBe(199); // 200 - 1
  });

  it("uses standard config for unmatched routes", () => {
    const result = checkRateLimitMiddleware(`mid-std-${midTestId}`, "/api/contacts");
    expect(result.remaining).toBe(99); // 100 - 1
  });
});
