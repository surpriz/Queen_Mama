/**
 * Structured Logging Library
 *
 * Provides consistent, structured JSON logging for better observability.
 * Logs are formatted for easy parsing by log aggregation services.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

interface LogContext {
  [key: string]: unknown;
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  service: string;
  environment: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

class Logger {
  private service: string;
  private minLevel: LogLevel;
  private environment: string;

  constructor(service: string = "queen-mama-api") {
    this.service = service;
    this.environment = process.env.NODE_ENV || "development";

    // In production, default to 'info' level; in development, allow 'debug'
    const configuredLevel = process.env.LOG_LEVEL as LogLevel | undefined;
    this.minLevel = configuredLevel || (this.environment === "production" ? "info" : "debug");
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.minLevel];
  }

  private formatEntry(level: LogLevel, message: string, context?: LogContext, error?: Error): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      service: this.service,
      environment: this.environment,
    };

    if (context && Object.keys(context).length > 0) {
      entry.context = this.sanitizeContext(context);
    }

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: this.environment !== "production" ? error.stack : undefined,
      };
    }

    return entry;
  }

  private sanitizeContext(context: LogContext): LogContext {
    const sanitized: LogContext = {};
    const sensitiveKeys = [
      "password",
      "token",
      "secret",
      "apikey",
      "api_key",
      "authorization",
      "cookie",
      "creditcard",
      "credit_card",
      "ssn",
    ];

    for (const [key, value] of Object.entries(context)) {
      const lowerKey = key.toLowerCase();

      // Redact sensitive values
      if (sensitiveKeys.some((sensitive) => lowerKey.includes(sensitive))) {
        sanitized[key] = "[REDACTED]";
      } else if (typeof value === "object" && value !== null) {
        // Recursively sanitize nested objects
        sanitized[key] = this.sanitizeContext(value as LogContext);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  private output(entry: LogEntry): void {
    const jsonString = JSON.stringify(entry);

    switch (entry.level) {
      case "debug":
        console.debug(jsonString);
        break;
      case "info":
        console.info(jsonString);
        break;
      case "warn":
        console.warn(jsonString);
        break;
      case "error":
        console.error(jsonString);
        break;
    }
  }

  debug(message: string, context?: LogContext): void {
    if (this.shouldLog("debug")) {
      this.output(this.formatEntry("debug", message, context));
    }
  }

  info(message: string, context?: LogContext): void {
    if (this.shouldLog("info")) {
      this.output(this.formatEntry("info", message, context));
    }
  }

  warn(message: string, context?: LogContext): void {
    if (this.shouldLog("warn")) {
      this.output(this.formatEntry("warn", message, context));
    }
  }

  error(message: string, error?: Error | unknown, context?: LogContext): void {
    if (this.shouldLog("error")) {
      const err = error instanceof Error ? error : undefined;
      const ctx = error instanceof Error ? context : (error as LogContext | undefined);
      this.output(this.formatEntry("error", message, ctx, err));
    }
  }

  /**
   * Create a child logger with additional context
   */
  child(context: LogContext): ChildLogger {
    return new ChildLogger(this, context);
  }
}

class ChildLogger {
  private parent: Logger;
  private context: LogContext;

  constructor(parent: Logger, context: LogContext) {
    this.parent = parent;
    this.context = context;
  }

  debug(message: string, context?: LogContext): void {
    this.parent.debug(message, { ...this.context, ...context });
  }

  info(message: string, context?: LogContext): void {
    this.parent.info(message, { ...this.context, ...context });
  }

  warn(message: string, context?: LogContext): void {
    this.parent.warn(message, { ...this.context, ...context });
  }

  error(message: string, error?: Error | unknown, context?: LogContext): void {
    this.parent.error(message, error, { ...this.context, ...context });
  }
}

// Singleton logger instance
export const logger = new Logger();

// Pre-configured loggers for specific services
export const authLogger = logger.child({ module: "auth" });
export const billingLogger = logger.child({ module: "billing" });
export const proxyLogger = logger.child({ module: "proxy" });
export const apiLogger = logger.child({ module: "api" });
export const gdprLogger = logger.child({ module: "gdpr" });

// Export for custom loggers
export { Logger, ChildLogger };

/**
 * Request logging middleware helper
 */
export function logRequest(
  method: string,
  path: string,
  statusCode: number,
  durationMs: number,
  context?: LogContext
): void {
  const level: LogLevel = statusCode >= 500 ? "error" : statusCode >= 400 ? "warn" : "info";

  const entry = {
    method,
    path,
    statusCode,
    durationMs,
    ...context,
  };

  switch (level) {
    case "error":
      logger.error(`${method} ${path} ${statusCode}`, undefined, entry);
      break;
    case "warn":
      logger.warn(`${method} ${path} ${statusCode}`, entry);
      break;
    default:
      logger.info(`${method} ${path} ${statusCode}`, entry);
  }
}
