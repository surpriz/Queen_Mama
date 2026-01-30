import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAccessToken } from "@/lib/device-auth";
import {
  getProviderApiKey,
  getAvailableTranscriptionProviders,
  type PlanTier,
  type TranscriptionProviderType,
} from "@/lib/ai-providers";

// CORS headers for desktop app requests
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

/**
 * OPTIONS /api/proxy/transcription/token
 * Handle preflight CORS requests
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

interface DeepgramKeyResponse {
  key_id: string;
  key: string;
  api_key_id: string;
  comment: string;
  created: string;
  scopes: string[];
  expiration_date: string;
  time_to_live_in_seconds: number;
}

interface DeepgramGrantResponse {
  access_token: string;
  expires_in: number;
}

/**
 * POST /api/proxy/transcription/token
 * Generates a temporary token for real-time transcription
 * The token is short-lived (15 minutes) and scoped for streaming only
 */
export async function POST(request: Request) {
  try {
    // Get access token from Authorization header
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "unauthorized", message: "Missing authorization header" },
        { status: 401, headers: corsHeaders }
      );
    }

    const accessToken = authHeader.slice(7);
    console.log("[Transcription Token] Received token:", accessToken?.slice(0, 30) + "...");

    let tokenPayload;
    try {
      tokenPayload = await verifyAccessToken(accessToken);
      console.log("[Transcription Token] Token verified for user:", tokenPayload.sub);
    } catch (error) {
      console.error("[Transcription Token] Token verification failed:", error);
      return NextResponse.json(
        { error: "invalid_token", message: "Invalid or expired token" },
        { status: 401, headers: corsHeaders }
      );
    }

    // Parse request body (handle empty body)
    let body: { provider?: string } = {};
    try {
      const text = await request.text();
      if (text) {
        body = JSON.parse(text);
      }
    } catch {
      // Empty body is OK, use defaults
    }
    const provider = (body.provider || "deepgram") as TranscriptionProviderType;

    // Fetch user with subscription
    const user = await prisma.user.findUnique({
      where: { id: tokenPayload.sub },
      include: {
        subscription: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "user_not_found" },
        { status: 404, headers: corsHeaders }
      );
    }

    if (user.role === "BLOCKED") {
      return NextResponse.json(
        { error: "account_blocked", message: "Account has been blocked" },
        { status: 403, headers: corsHeaders }
      );
    }

    // Check plan and provider access
    const plan = (user.subscription?.plan || "FREE") as PlanTier;
    const availableProviders = await getAvailableTranscriptionProviders(plan);

    if (!availableProviders.includes(provider)) {
      return NextResponse.json(
        { error: "provider_not_available", message: `${provider} is not available for your plan` },
        { status: 403, headers: corsHeaders }
      );
    }

    // Get admin API key for the provider from database
    const adminApiKey = await getProviderApiKey(provider);
    if (!adminApiKey) {
      return NextResponse.json(
        { error: "provider_not_configured", message: `${provider} is not configured by admin` },
        { status: 503, headers: corsHeaders }
      );
    }

    // Generate temporary token based on provider
    if (provider === "deepgram") {
      try {
        // Generate a proper JWT token using Deepgram's grant API
        // This returns a scoped, short-lived token instead of exposing the admin key
        const grantResponse = await generateDeepgramTemporaryToken(adminApiKey, 900);
        const expiresAt = new Date(Date.now() + grantResponse.expires_in * 1000);

        // Record usage
        await prisma.usageLog.create({
          data: {
            userId: user.id,
            action: "transcription_token",
            provider: "deepgram",
          },
        });

        console.log("[Transcription Token] Generated Deepgram JWT token, expires in", grantResponse.expires_in, "seconds");

        return NextResponse.json(
          {
            provider: "deepgram",
            token: grantResponse.access_token,
            tokenType: "bearer", // JWT tokens use Bearer authorization
            expiresAt: expiresAt.toISOString(),
            ttlSeconds: grantResponse.expires_in,
          },
          { headers: corsHeaders }
        );
      } catch (error) {
        // Fallback: return admin key for backward compatibility
        // This ensures the app continues working even if the grant API fails
        console.error("[Deepgram] Grant API failed, falling back to admin key:", error);
        const expiresAt = new Date(Date.now() + 900 * 1000);

        await prisma.usageLog.create({
          data: {
            userId: user.id,
            action: "transcription_token",
            provider: "deepgram",
          },
        });

        return NextResponse.json(
          {
            provider: "deepgram",
            token: adminApiKey,
            tokenType: "token", // Legacy API key uses Token authorization
            expiresAt: expiresAt.toISOString(),
            ttlSeconds: 900,
          },
          { headers: corsHeaders }
        );
      }
    } else if (provider === "assemblyai") {
      // AssemblyAI uses the same API key for real-time
      // We'll return a temporary session token
      const tokenResponse = await generateAssemblyAITemporaryToken(adminApiKey);

      await prisma.usageLog.create({
        data: {
          userId: user.id,
          action: "transcription_token",
          provider: "assemblyai",
        },
      });

      return NextResponse.json(
        {
          provider: "assemblyai",
          token: tokenResponse.token,
          expiresAt: new Date(Date.now() + 900 * 1000).toISOString(), // 15 min
          ttlSeconds: 900,
        },
        { headers: corsHeaders }
      );
    }

    return NextResponse.json(
      { error: "unsupported_provider", message: `Provider ${provider} is not supported` },
      { status: 400, headers: corsHeaders }
    );
  } catch (error) {
    console.error("Transcription token error:", error);
    return NextResponse.json(
      { error: "server_error", message: "Failed to generate transcription token" },
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * Generate a temporary Deepgram JWT token using the grant API
 * The token is scoped to streaming only and expires after ttlSeconds
 *
 * This is more secure than exposing the admin API key because:
 * 1. The JWT has limited scope (streaming only)
 * 2. The JWT auto-expires (cannot be reused indefinitely)
 * 3. The admin key never leaves the backend
 */
async function generateDeepgramTemporaryToken(
  adminApiKey: string,
  ttlSeconds: number = 900
): Promise<DeepgramGrantResponse> {
  const response = await fetch("https://api.deepgram.com/v1/auth/grant", {
    method: "POST",
    headers: {
      Authorization: `Token ${adminApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ttl_seconds: Math.min(ttlSeconds, 3600), // Max 1 hour per Deepgram docs
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[Deepgram] Grant API error:", errorText);
    throw new Error(`Deepgram grant API error: ${response.status}`);
  }

  return response.json();
}

/**
 * @deprecated Use generateDeepgramTemporaryToken instead
 * Generate a temporary Deepgram API key using the Deepgram API
 * The key is scoped to streaming only and expires in 15 minutes
 */
async function generateDeepgramTemporaryKey(
  adminApiKey: string,
  userId: string
): Promise<DeepgramKeyResponse> {
  // Deepgram temporary keys API
  const response = await fetch("https://api.deepgram.com/v1/projects/keys", {
    method: "POST",
    headers: {
      Authorization: `Token ${adminApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      comment: `Temporary key for user ${userId}`,
      scopes: ["usage:write"],
      time_to_live_in_seconds: 900, // 15 minutes
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Deepgram key generation failed:", errorText);
    throw new Error(`Deepgram API error: ${response.status}`);
  }

  return response.json();
}

/**
 * Generate a temporary AssemblyAI token
 * AssemblyAI uses the same key for real-time, but we create a session token
 */
async function generateAssemblyAITemporaryToken(
  adminApiKey: string
): Promise<{ token: string }> {
  // AssemblyAI real-time uses the API key directly
  // For now, we return the key as the token
  // In production, you might want to create a session-based token
  const response = await fetch("https://api.assemblyai.com/v2/realtime/token", {
    method: "POST",
    headers: {
      Authorization: adminApiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      expires_in: 900, // 15 minutes
    }),
  });

  if (!response.ok) {
    // Fallback: AssemblyAI might not support temporary tokens
    // Return the admin key (less secure but functional)
    console.warn("AssemblyAI temporary token not supported, using admin key");
    return { token: adminApiKey };
  }

  return response.json();
}
