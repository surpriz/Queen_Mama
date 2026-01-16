import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  verifyAccessToken,
  signLicenseResponse,
  AUTH_CONSTANTS,
} from "@/lib/device-auth";
import { licenseValidateSchema } from "@/lib/validations";

// Feature limits based on plan
const PLAN_FEATURES = {
  FREE: {
    smartModeEnabled: true,
    smartModeLimit: 5, // per day
    customModesEnabled: false, // view only
    exportFormats: ["plainText"],
    autoAnswerEnabled: false,
    sessionSyncEnabled: false,
    dailyAiRequestLimit: 50,
    maxSyncedSessions: 5,
    maxTranscriptSize: 10240, // 10KB
  },
  PRO: {
    smartModeEnabled: true,
    smartModeLimit: null, // unlimited
    customModesEnabled: true,
    exportFormats: ["plainText", "markdown", "json"],
    autoAnswerEnabled: true,
    sessionSyncEnabled: true,
    dailyAiRequestLimit: null, // unlimited
    maxSyncedSessions: null, // unlimited
    maxTranscriptSize: 1048576, // 1MB
  },
} as const;

/**
 * POST /api/license/validate
 * Validates license and returns feature flags
 * Called by macOS app on startup and periodically
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

    const body = await request.json();
    const parsed = licenseValidateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "invalid_request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { deviceId } = parsed.data;

    // Verify device matches token
    if (deviceId !== tokenPayload.deviceId) {
      return NextResponse.json(
        { error: "device_mismatch", message: "Device ID does not match token" },
        { status: 403 }
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

    // Determine plan and status
    const subscription = user.subscription;
    const plan = subscription?.plan || "FREE";
    const status = subscription?.status || "ACTIVE";

    // Calculate trial info if applicable
    let trial = null;
    if (status === "TRIALING" && subscription?.currentPeriodEnd) {
      const daysRemaining = Math.max(
        0,
        Math.ceil(
          (subscription.currentPeriodEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        )
      );
      trial = {
        isActive: true,
        daysRemaining,
        endsAt: subscription.currentPeriodEnd.toISOString(),
      };
    }

    // Get features based on plan
    const features = PLAN_FEATURES[plan] || PLAN_FEATURES.FREE;

    // Build response data (without signature)
    const responseData = {
      valid: true,
      plan,
      status,
      features,
      trial,
      cacheTTL: AUTH_CONSTANTS.LICENSE_CACHE_TTL_SECONDS,
      validatedAt: new Date().toISOString(),
    };

    // Sign the response for integrity verification
    const signature = signLicenseResponse(responseData);

    // Update device last seen
    await prisma.device.updateMany({
      where: { deviceId },
      data: { lastSeenAt: new Date() },
    });

    // Get today's usage stats for the user
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayUsage = await prisma.usageLog.groupBy({
      by: ["action"],
      where: {
        userId: user.id,
        createdAt: { gte: today },
      },
      _count: { action: true },
    });

    const usageStats = {
      smartModeUsedToday: todayUsage.find((u) => u.action === "smart_mode")?._count.action || 0,
      aiRequestsToday: todayUsage.find((u) => u.action === "ai_request")?._count.action || 0,
    };

    return NextResponse.json({
      ...responseData,
      usage: usageStats,
      signature,
    });
  } catch (error) {
    console.error("License validation error:", error);
    return NextResponse.json(
      { error: "server_error", message: "License validation failed" },
      { status: 500 }
    );
  }
}
