import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAccessToken } from "@/lib/device-auth";
import {
  getAvailableAIProviders,
  getAvailableTranscriptionProviders,
  TIER_LIMITS,
  type PlanTier,
} from "@/lib/ai-providers";

/**
 * GET /api/proxy/config
 * Returns available services and limits based on user's subscription tier
 * Called by macOS app on startup to determine available providers
 */
export async function GET(request: Request) {
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

    // Determine plan
    const plan = (user.subscription?.plan || "FREE") as PlanTier;
    const tierConfig = TIER_LIMITS[plan];

    // Get available providers (configured by admin in database)
    const availableAIProviders = await getAvailableAIProviders(plan);
    const availableTranscriptionProviders = await getAvailableTranscriptionProviders(plan);

    // Get today's usage
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayUsage = await prisma.usageLog.count({
      where: {
        userId: user.id,
        action: "ai_request",
        createdAt: { gte: today },
      },
    });

    // Build response
    const response = {
      plan,
      services: {
        ai: {
          enabled: availableAIProviders.length > 0,
          providers: availableAIProviders,
          maxTokens: tierConfig.maxTokens,
          smartModeEnabled: tierConfig.smartMode,
          dailyLimit: tierConfig.dailyAiRequests,
          usedToday: todayUsage,
          remaining: tierConfig.dailyAiRequests
            ? Math.max(0, tierConfig.dailyAiRequests - todayUsage)
            : null,
        },
        transcription: {
          enabled: tierConfig.transcription && availableTranscriptionProviders.length > 0,
          providers: availableTranscriptionProviders,
          tokenTTLSeconds: 900, // 15 minutes
        },
      },
      cacheTTL: 3600, // 1 hour cache
      configuredAt: new Date().toISOString(),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Proxy config error:", error);
    return NextResponse.json(
      { error: "server_error", message: "Failed to fetch configuration" },
      { status: 500 }
    );
  }
}
