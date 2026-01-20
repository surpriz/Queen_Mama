import { NextResponse } from "next/server";

// In-memory store for rate limiting
// In production, consider using Redis (e.g., @upstash/ratelimit)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

interface RateLimitConfig {
  // Maximum number of requests allowed in the window
  maxRequests: number;
  // Time window in seconds
  windowSeconds: number;
  // Optional: different limits for authenticated users
  authenticatedMaxRequests?: number;
}

interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetAt: number;
  retryAfter?: number;
}

// Default configurations for different endpoint types
export const rateLimitConfigs = {
  // Standard API endpoints
  standard: {
    maxRequests: 100,
    windowSeconds: 60, // 100 requests per minute
  },

  // Authentication endpoints (stricter to prevent brute force)
  auth: {
    maxRequests: 10,
    windowSeconds: 60, // 10 attempts per minute
  },

  // Password reset (very strict to prevent enumeration)
  passwordReset: {
    maxRequests: 5,
    windowSeconds: 300, // 5 requests per 5 minutes
  },

  // AI proxy endpoints (resource intensive)
  aiProxy: {
    maxRequests: 30,
    windowSeconds: 60, // 30 requests per minute
    authenticatedMaxRequests: 100, // More for authenticated users
  },

  // Transcription endpoints
  transcription: {
    maxRequests: 20,
    windowSeconds: 60,
    authenticatedMaxRequests: 60,
  },

  // Webhook endpoints (external services)
  webhook: {
    maxRequests: 200,
    windowSeconds: 60, // Allow more for webhooks
  },
};

/**
 * Check and apply rate limit for a given identifier
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now();
  const windowMs = config.windowSeconds * 1000;

  // Clean up expired entries periodically
  if (Math.random() < 0.01) {
    cleanupExpiredEntries(now);
  }

  // Get or create rate limit entry
  const entry = rateLimitStore.get(identifier);

  if (!entry || now >= entry.resetAt) {
    // First request or window expired
    const resetAt = now + windowMs;
    rateLimitStore.set(identifier, { count: 1, resetAt });
    return {
      success: true,
      remaining: config.maxRequests - 1,
      resetAt,
    };
  }

  // Check if limit exceeded
  if (entry.count >= config.maxRequests) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return {
      success: false,
      remaining: 0,
      resetAt: entry.resetAt,
      retryAfter,
    };
  }

  // Increment counter
  entry.count++;
  rateLimitStore.set(identifier, entry);

  return {
    success: true,
    remaining: config.maxRequests - entry.count,
    resetAt: entry.resetAt,
  };
}

/**
 * Clean up expired entries from the store
 */
function cleanupExpiredEntries(now: number): void {
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now >= entry.resetAt) {
      rateLimitStore.delete(key);
    }
  }
}

/**
 * Get identifier from request (IP address or user ID)
 */
export function getIdentifier(request: Request, userId?: string): string {
  if (userId) {
    return `user:${userId}`;
  }

  // Get IP from headers (works with Vercel, Cloudflare, etc.)
  const forwardedFor = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");

  const ip = forwardedFor?.split(",")[0]?.trim() || realIp || "unknown";
  return `ip:${ip}`;
}

/**
 * Create a rate limit error response
 */
export function rateLimitResponse(result: RateLimitResult): NextResponse {
  return NextResponse.json(
    {
      error: "Too many requests",
      message: `Rate limit exceeded. Please try again in ${result.retryAfter} seconds.`,
      retryAfter: result.retryAfter,
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(result.retryAfter),
        "X-RateLimit-Limit": String(result.remaining + 1),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
      },
    }
  );
}

/**
 * Apply rate limit headers to a successful response
 */
export function addRateLimitHeaders(
  response: NextResponse,
  result: RateLimitResult,
  limit: number
): NextResponse {
  response.headers.set("X-RateLimit-Limit", String(limit));
  response.headers.set("X-RateLimit-Remaining", String(result.remaining));
  response.headers.set(
    "X-RateLimit-Reset",
    String(Math.ceil(result.resetAt / 1000))
  );
  return response;
}

/**
 * Higher-order function to wrap API routes with rate limiting
 */
export function withRateLimit<T extends Request>(
  handler: (request: T) => Promise<NextResponse>,
  config: RateLimitConfig = rateLimitConfigs.standard,
  getUserId?: (request: T) => Promise<string | null>
) {
  return async (request: T): Promise<NextResponse> => {
    // Get user ID if authenticated
    const userId = getUserId ? await getUserId(request) : null;

    // Use authenticated limit if available and user is authenticated
    const effectiveConfig =
      userId && config.authenticatedMaxRequests
        ? { ...config, maxRequests: config.authenticatedMaxRequests }
        : config;

    // Get identifier (prefer user ID over IP)
    const identifier = getIdentifier(request, userId || undefined);

    // Check rate limit
    const result = checkRateLimit(identifier, effectiveConfig);

    if (!result.success) {
      return rateLimitResponse(result);
    }

    // Execute handler and add rate limit headers
    const response = await handler(request);
    return addRateLimitHeaders(response, result, effectiveConfig.maxRequests);
  };
}

/**
 * Middleware helper for rate limiting
 * Use this in middleware.ts to apply rate limiting at the edge
 */
export function checkRateLimitMiddleware(
  identifier: string,
  pathname: string
): RateLimitResult {
  // Determine config based on pathname
  let config = rateLimitConfigs.standard;

  if (
    pathname.includes("/api/auth/") &&
    !pathname.includes("/api/auth/device/")
  ) {
    config = rateLimitConfigs.auth;
  } else if (
    pathname.includes("/api/auth/forgot-password") ||
    pathname.includes("/api/auth/reset-password")
  ) {
    config = rateLimitConfigs.passwordReset;
  } else if (pathname.includes("/api/proxy/ai")) {
    config = rateLimitConfigs.aiProxy;
  } else if (pathname.includes("/api/proxy/transcription")) {
    config = rateLimitConfigs.transcription;
  } else if (pathname.includes("/api/billing/webhook")) {
    config = rateLimitConfigs.webhook;
  }

  return checkRateLimit(identifier, config);
}
