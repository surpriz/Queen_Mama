import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAccessToken } from "@/lib/device-auth";
import {
  getAvailableAIProviders,
  getAvailableTranscriptionProviders,
  getAvailableTranslationProviders,
  TIER_LIMITS,
  type PlanTier,
} from "@/lib/ai-providers";
import { getPostHogServer } from "@/lib/posthog";

type PromptExperiment = { key: string; op: "control" | "override" | "append"; text?: string };

/**
 * Evaluate the `prompt_experiments` PostHog feature flag for this user and
 * return a sanitized map keyed by the app's ResponseType.experimentKey
 * (assist, whatToSay, followUp, recap, decode, custom). The flag's JSON payload
 * holds the variant prompts, so they can be edited in PostHog with no app release.
 * Non-fatal: any failure returns undefined and the app falls back to built-in prompts.
 */
async function getPromptExperiments(userId: string): Promise<Record<string, PromptExperiment> | undefined> {
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return undefined;
  try {
    const posthog = getPostHogServer();
    const payload = await posthog.getFeatureFlagPayload("prompt_experiments", userId);
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return undefined;

    const cleaned: Record<string, PromptExperiment> = {};
    for (const [responseType, raw] of Object.entries(payload as Record<string, unknown>)) {
      if (!raw || typeof raw !== "object") continue;
      const v = raw as Record<string, unknown>;
      const op = v.op === "override" || v.op === "append" ? v.op : "control";
      cleaned[responseType] = {
        key: typeof v.key === "string" ? v.key : "variant",
        op,
        text: typeof v.text === "string" ? v.text : undefined,
      };
    }
    if (Object.keys(cleaned).length === 0) return undefined;

    // Log exposure for A/B analysis. flushAt:1 flushes immediately; do NOT call
    // shutdown() here — it would dispose the cached client for later requests.
    const variant = await posthog.getFeatureFlag("prompt_experiments", userId);
    posthog.capture({
      distinctId: userId,
      event: "prompt_experiment_exposure",
      properties: { variant, keys: Object.keys(cleaned) },
    });

    return cleaned;
  } catch (err) {
    console.error("prompt_experiments evaluation failed (non-fatal):", err);
    return undefined;
  }
}

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
    const availableTranslationProviders = await getAvailableTranslationProviders(plan);

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

    // Server-driven prompt A/B experiments (optional; PostHog-backed)
    const experiments = await getPromptExperiments(user.id);

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
        translation: {
          enabled: tierConfig.translation && availableTranslationProviders.length > 0,
          provider: availableTranslationProviders[0] ?? null,
          monthlyCharsLimit: tierConfig.monthlyTranslationChars,
        },
      },
      cacheTTL: 3600, // 1 hour cache
      configuredAt: new Date().toISOString(),
      ...(experiments ? { experiments } : {}),
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
