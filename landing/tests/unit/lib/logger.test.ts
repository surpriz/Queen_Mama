// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// We need to test the Logger class directly, so we import and instantiate
// The module uses process.env for configuration, so we control those in tests
describe("logger", () => {
  let consoleSpy: {
    debug: ReturnType<typeof vi.spyOn>;
    info: ReturnType<typeof vi.spyOn>;
    warn: ReturnType<typeof vi.spyOn>;
    error: ReturnType<typeof vi.spyOn>;
  };

  beforeEach(() => {
    consoleSpy = {
      debug: vi.spyOn(console, "debug").mockImplementation(() => {}),
      info: vi.spyOn(console, "info").mockImplementation(() => {}),
      warn: vi.spyOn(console, "warn").mockImplementation(() => {}),
      error: vi.spyOn(console, "error").mockImplementation(() => {}),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================
  // Sensitive Data Redaction
  // =========================================
  describe("sensitive data redaction", () => {
    it("should redact password fields", async () => {
      const { Logger } = await import("@/lib/logger");
      const testLogger = new Logger("test-service");

      testLogger.info("login attempt", { userPassword: "secret123", email: "test@test.com" });

      expect(consoleSpy.info).toHaveBeenCalledTimes(1);
      const logEntry = JSON.parse(consoleSpy.info.mock.calls[0][0] as string);
      expect(logEntry.context.userPassword).toBe("[REDACTED]");
      expect(logEntry.context.email).toBe("test@test.com");
    });

    it("should redact token fields", async () => {
      const { Logger } = await import("@/lib/logger");
      const testLogger = new Logger("test-service");

      testLogger.info("token info", { accessToken: "abc123", userId: "user1" });

      const logEntry = JSON.parse(consoleSpy.info.mock.calls[0][0] as string);
      expect(logEntry.context.accessToken).toBe("[REDACTED]");
      expect(logEntry.context.userId).toBe("user1");
    });

    it("should redact apikey fields (case insensitive)", async () => {
      const { Logger } = await import("@/lib/logger");
      const testLogger = new Logger("test-service");

      testLogger.info("key info", { ApiKey: "sk-123", provider: "openai" });

      const logEntry = JSON.parse(consoleSpy.info.mock.calls[0][0] as string);
      expect(logEntry.context.ApiKey).toBe("[REDACTED]");
      expect(logEntry.context.provider).toBe("openai");
    });

    it("should redact api_key fields", async () => {
      const { Logger } = await import("@/lib/logger");
      const testLogger = new Logger("test-service");

      testLogger.info("key info", { api_key: "sk-456" });

      const logEntry = JSON.parse(consoleSpy.info.mock.calls[0][0] as string);
      expect(logEntry.context.api_key).toBe("[REDACTED]");
    });

    it("should redact secret fields", async () => {
      const { Logger } = await import("@/lib/logger");
      const testLogger = new Logger("test-service");

      testLogger.info("secret info", { clientSecret: "very-secret" });

      const logEntry = JSON.parse(consoleSpy.info.mock.calls[0][0] as string);
      expect(logEntry.context.clientSecret).toBe("[REDACTED]");
    });

    it("should redact authorization fields", async () => {
      const { Logger } = await import("@/lib/logger");
      const testLogger = new Logger("test-service");

      testLogger.info("auth info", { authorization: "Bearer xyz" });

      const logEntry = JSON.parse(consoleSpy.info.mock.calls[0][0] as string);
      expect(logEntry.context.authorization).toBe("[REDACTED]");
    });

    it("should redact cookie fields", async () => {
      const { Logger } = await import("@/lib/logger");
      const testLogger = new Logger("test-service");

      testLogger.info("cookie info", { sessionCookie: "abc123" });

      const logEntry = JSON.parse(consoleSpy.info.mock.calls[0][0] as string);
      expect(logEntry.context.sessionCookie).toBe("[REDACTED]");
    });

    it("should redact creditcard and ssn fields", async () => {
      const { Logger } = await import("@/lib/logger");
      const testLogger = new Logger("test-service");

      testLogger.info("pii info", { creditCard: "4111111111", ssn: "123-45-6789" });

      const logEntry = JSON.parse(consoleSpy.info.mock.calls[0][0] as string);
      expect(logEntry.context.creditCard).toBe("[REDACTED]");
      expect(logEntry.context.ssn).toBe("[REDACTED]");
    });

    it("should recursively redact nested objects", async () => {
      const { Logger } = await import("@/lib/logger");
      const testLogger = new Logger("test-service");

      testLogger.info("nested info", {
        user: {
          password: "deep-secret",
          name: "Test",
        },
      });

      const logEntry = JSON.parse(consoleSpy.info.mock.calls[0][0] as string);
      expect(logEntry.context.user.password).toBe("[REDACTED]");
      expect(logEntry.context.user.name).toBe("Test");
    });

    it("should not redact non-sensitive fields", async () => {
      const { Logger } = await import("@/lib/logger");
      const testLogger = new Logger("test-service");

      testLogger.info("safe info", { userId: "123", action: "login", path: "/api/test" });

      const logEntry = JSON.parse(consoleSpy.info.mock.calls[0][0] as string);
      expect(logEntry.context.userId).toBe("123");
      expect(logEntry.context.action).toBe("login");
      expect(logEntry.context.path).toBe("/api/test");
    });
  });

  // =========================================
  // Log Levels
  // =========================================
  describe("log levels", () => {
    it("should output debug messages via console.debug", async () => {
      const { Logger } = await import("@/lib/logger");
      const testLogger = new Logger("test-service");

      testLogger.debug("debug message");

      expect(consoleSpy.debug).toHaveBeenCalledTimes(1);
      const logEntry = JSON.parse(consoleSpy.debug.mock.calls[0][0] as string);
      expect(logEntry.level).toBe("debug");
      expect(logEntry.message).toBe("debug message");
    });

    it("should output info messages via console.info", async () => {
      const { Logger } = await import("@/lib/logger");
      const testLogger = new Logger("test-service");

      testLogger.info("info message");

      expect(consoleSpy.info).toHaveBeenCalledTimes(1);
      const logEntry = JSON.parse(consoleSpy.info.mock.calls[0][0] as string);
      expect(logEntry.level).toBe("info");
    });

    it("should output warn messages via console.warn", async () => {
      const { Logger } = await import("@/lib/logger");
      const testLogger = new Logger("test-service");

      testLogger.warn("warn message");

      expect(consoleSpy.warn).toHaveBeenCalledTimes(1);
      const logEntry = JSON.parse(consoleSpy.warn.mock.calls[0][0] as string);
      expect(logEntry.level).toBe("warn");
    });

    it("should output error messages via console.error", async () => {
      const { Logger } = await import("@/lib/logger");
      const testLogger = new Logger("test-service");

      testLogger.error("error message");

      expect(consoleSpy.error).toHaveBeenCalledTimes(1);
      const logEntry = JSON.parse(consoleSpy.error.mock.calls[0][0] as string);
      expect(logEntry.level).toBe("error");
    });

    it("should include error details when an Error is passed", async () => {
      const { Logger } = await import("@/lib/logger");
      const testLogger = new Logger("test-service");

      const err = new Error("Something went wrong");
      testLogger.error("operation failed", err);

      const logEntry = JSON.parse(consoleSpy.error.mock.calls[0][0] as string);
      expect(logEntry.error).toBeDefined();
      expect(logEntry.error.name).toBe("Error");
      expect(logEntry.error.message).toBe("Something went wrong");
    });

    it("should include context with error when both provided", async () => {
      const { Logger } = await import("@/lib/logger");
      const testLogger = new Logger("test-service");

      const err = new Error("DB fail");
      testLogger.error("db error", err, { query: "SELECT 1" });

      const logEntry = JSON.parse(consoleSpy.error.mock.calls[0][0] as string);
      expect(logEntry.error.message).toBe("DB fail");
      expect(logEntry.context.query).toBe("SELECT 1");
    });
  });

  // =========================================
  // Log Entry Structure
  // =========================================
  describe("log entry structure", () => {
    it("should include timestamp, level, message, service, and environment", async () => {
      const { Logger } = await import("@/lib/logger");
      const testLogger = new Logger("my-service");

      testLogger.info("test message");

      const logEntry = JSON.parse(consoleSpy.info.mock.calls[0][0] as string);
      expect(logEntry.timestamp).toBeDefined();
      expect(logEntry.level).toBe("info");
      expect(logEntry.message).toBe("test message");
      expect(logEntry.service).toBe("my-service");
      expect(logEntry.environment).toBeDefined();
    });

    it("should omit context if no context provided", async () => {
      const { Logger } = await import("@/lib/logger");
      const testLogger = new Logger("test-service");

      testLogger.info("no context");

      const logEntry = JSON.parse(consoleSpy.info.mock.calls[0][0] as string);
      expect(logEntry.context).toBeUndefined();
    });

    it("should omit context if empty object provided", async () => {
      const { Logger } = await import("@/lib/logger");
      const testLogger = new Logger("test-service");

      testLogger.info("empty context", {});

      const logEntry = JSON.parse(consoleSpy.info.mock.calls[0][0] as string);
      expect(logEntry.context).toBeUndefined();
    });
  });

  // =========================================
  // Child Logger
  // =========================================
  describe("child logger", () => {
    it("should include parent context in child logs", async () => {
      const { Logger } = await import("@/lib/logger");
      const testLogger = new Logger("test-service");
      const child = testLogger.child({ module: "auth" });

      child.info("child message", { action: "login" });

      const logEntry = JSON.parse(consoleSpy.info.mock.calls[0][0] as string);
      expect(logEntry.context.module).toBe("auth");
      expect(logEntry.context.action).toBe("login");
    });

    it("should have dedicated module loggers", async () => {
      const { authLogger, billingLogger, proxyLogger, apiLogger, gdprLogger } =
        await import("@/lib/logger");

      expect(authLogger).toBeDefined();
      expect(billingLogger).toBeDefined();
      expect(proxyLogger).toBeDefined();
      expect(apiLogger).toBeDefined();
      expect(gdprLogger).toBeDefined();
    });
  });

  // =========================================
  // logRequest helper
  // =========================================
  describe("logRequest", () => {
    it("should log 500+ status as error", async () => {
      const { logRequest } = await import("@/lib/logger");

      logRequest("POST", "/api/test", 500, 100);

      expect(consoleSpy.error).toHaveBeenCalledTimes(1);
    });

    it("should log 400-499 status as warn", async () => {
      const { logRequest } = await import("@/lib/logger");

      logRequest("GET", "/api/test", 404, 50);

      expect(consoleSpy.warn).toHaveBeenCalledTimes(1);
    });

    it("should log 200-399 status as info", async () => {
      const { logRequest } = await import("@/lib/logger");

      logRequest("GET", "/api/test", 200, 25);

      expect(consoleSpy.info).toHaveBeenCalledTimes(1);
    });
  });
});
