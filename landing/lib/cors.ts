import { NextResponse } from "next/server";

// Allowed origins for CORS
const ALLOWED_ORIGINS = [
  "https://queenmama.app",
  "https://www.queenmama.app",
  "https://queenmama.co",
  "https://www.queenmama.co",
];

// Development origins
const DEV_ORIGINS = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];

// Preview/staging origins pattern
const PREVIEW_ORIGIN_PATTERN = /^https:\/\/[\w-]+\.vercel\.app$/;

/**
 * Check if an origin is allowed
 */
export function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return false;

  // Allow production domains
  if (ALLOWED_ORIGINS.includes(origin)) return true;

  // Allow development origins in development
  if (process.env.NODE_ENV === "development" && DEV_ORIGINS.includes(origin)) {
    return true;
  }

  // Allow Vercel preview deployments
  if (process.env.VERCEL_ENV === "preview" && PREVIEW_ORIGIN_PATTERN.test(origin)) {
    return true;
  }

  return false;
}

/**
 * Add CORS headers to a response
 */
export function addCorsHeaders(
  response: NextResponse,
  origin: string | null,
  methods: string[] = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
): NextResponse {
  // Only add CORS headers if origin is allowed
  if (origin && isOriginAllowed(origin)) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Access-Control-Allow-Methods", methods.join(", "));
    response.headers.set(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, X-Requested-With"
    );
    response.headers.set("Access-Control-Max-Age", "86400");
    response.headers.set("Access-Control-Allow-Credentials", "true");
  }

  return response;
}

/**
 * Create a CORS preflight response
 */
export function corsPreflightResponse(origin: string | null): NextResponse {
  const response = new NextResponse(null, { status: 204 });
  return addCorsHeaders(response, origin);
}

/**
 * Handle CORS for an API route
 * Returns a preflight response for OPTIONS requests, or null to continue processing
 */
export function handleCors(
  request: Request
): NextResponse | null {
  const origin = request.headers.get("origin");

  // Handle preflight requests
  if (request.method === "OPTIONS") {
    if (isOriginAllowed(origin)) {
      return corsPreflightResponse(origin);
    } else {
      return new NextResponse(null, { status: 403 });
    }
  }

  return null;
}

/**
 * Wrap an API handler with CORS support
 */
export function withCors<T extends Request>(
  handler: (request: T) => Promise<NextResponse>,
  methods: string[] = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
) {
  return async (request: T): Promise<NextResponse> => {
    const origin = request.headers.get("origin");

    // Handle preflight
    if (request.method === "OPTIONS") {
      if (isOriginAllowed(origin)) {
        return corsPreflightResponse(origin);
      } else {
        return new NextResponse(null, { status: 403 });
      }
    }

    // Execute handler
    const response = await handler(request);

    // Add CORS headers to response
    return addCorsHeaders(response, origin, methods);
  };
}
