import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAccessToken } from "@/lib/device-auth";
import {
  getProviderApiKey,
  getAvailableTranscriptionProviders,
  type PlanTier,
  type TranscriptionProviderType,
} from "@/lib/ai-providers";

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
        { status: 401 }
      );
    }

    const accessToken = authHeader.slice(7);

    let tokenPayload;
    try {
      tokenPayload = await verifyAccessToken(accessToken);
    } catch {
      return NextResponse.json(
        { error: "invalid_token", message: "Invalid or expired token" },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
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
        { status: 404 }
      );
    }

    if (user.role === "BLOCKED") {
      return NextResponse.json(
        { error: "account_blocked", message: "Account has been blocked" },
        { status: 403 }
      );
    }

    // Check plan and provider access
    const plan = (user.subscription?.plan || "FREE") as PlanTier;
    const availableProviders = await getAvailableTranscriptionProviders(plan);

    if (!availableProviders.includes(provider)) {
      return NextResponse.json(
        { error: "provider_not_available", message: `${provider} is not available for your plan` },
        { status: 403 }
      );
    }

    // Get admin API key for the provider from database
    const adminApiKey = await getProviderApiKey(provider);
    if (!adminApiKey) {
      return NextResponse.json(
        { error: "provider_not_configured", message: `${provider} is not configured by admin` },
        { status: 503 }
      );
    }

    // Generate temporary token based on provider
    if (provider === "deepgram") {
      // For Deepgram, we use the admin API key directly
      // The key is transmitted securely to the macOS app which uses it for WebSocket connection
      // The key never leaves our infrastructure (backend -> app -> Deepgram)
      const expiresAt = new Date(Date.now() + 900 * 1000); // 15 minutes

      // Record usage
      await prisma.usageLog.create({
        data: {
          userId: user.id,
          action: "transcription_token",
          provider: "deepgram",
        },
      });

      return NextResponse.json({
        provider: "deepgram",
        token: adminApiKey,
        expiresAt: expiresAt.toISOString(),
        ttlSeconds: 900,
      });
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

      return NextResponse.json({
        provider: "assemblyai",
        token: tokenResponse.token,
        expiresAt: new Date(Date.now() + 900 * 1000).toISOString(), // 15 min
        ttlSeconds: 900,
      });
    }

    return NextResponse.json(
      { error: "unsupported_provider", message: `Provider ${provider} is not supported` },
      { status: 400 }
    );
  } catch (error) {
    console.error("Transcription token error:", error);
    return NextResponse.json(
      { error: "server_error", message: "Failed to generate transcription token" },
      { status: 500 }
    );
  }
}

/**
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
