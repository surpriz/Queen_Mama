import { NextRequest } from "next/server";

/**
 * Create a mock NextRequest for API route testing
 */
export function createMockRequest(
  url: string,
  options: {
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
    searchParams?: Record<string, string>;
  } = {}
): NextRequest {
  const { method = "GET", body, headers = {}, searchParams = {} } = options;

  const urlObj = new URL(url, "http://localhost:3000");
  for (const [key, value] of Object.entries(searchParams)) {
    urlObj.searchParams.set(key, value);
  }

  const requestInit: RequestInit = {
    method,
    headers: new Headers({
      "Content-Type": "application/json",
      ...headers,
    }),
  };

  if (body && method !== "GET") {
    requestInit.body = JSON.stringify(body);
  }

  return new NextRequest(urlObj, requestInit as never);
}

/**
 * Create a mock request with Bearer token auth
 */
export function createAuthenticatedRequest(
  url: string,
  token: string,
  options: Omit<Parameters<typeof createMockRequest>[1], "headers"> & {
    headers?: Record<string, string>;
  } = {}
): NextRequest {
  return createMockRequest(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
}

/**
 * Parse a NextResponse/Response into JSON
 */
export async function parseResponse<T = unknown>(
  response: Response
): Promise<{ status: number; data: T; headers: Headers }> {
  const data = (await response.json()) as T;
  return {
    status: response.status,
    data,
    headers: response.headers,
  };
}
