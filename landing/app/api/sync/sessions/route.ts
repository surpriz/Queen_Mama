import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAccessToken } from "@/lib/device-auth";
import { sessionSyncSchema, sessionSyncBatchSchema } from "@/lib/validations";

/**
 * POST /api/sync/sessions
 * Upload session(s) from macOS app
 * Requires PRO subscription for sync
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

    // Check subscription
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
        { error: "account_blocked" },
        { status: 403 }
      );
    }

    // Check if user has PRO or ENTERPRISE subscription for sync
    const hasPaidPlan = (user.subscription?.plan === "PRO" || user.subscription?.plan === "ENTERPRISE") &&
      (user.subscription.status === "ACTIVE" || user.subscription.status === "TRIALING");

    if (!hasPaidPlan) {
      return NextResponse.json(
        {
          error: "subscription_required",
          message: "Session sync requires a PRO or ENTERPRISE subscription",
          upgradeUrl: "/dashboard/billing",
        },
        { status: 403 }
      );
    }

    const body = await request.json();

    // Determine if batch or single session
    let sessions: typeof sessionSyncSchema._output[];

    if (body.sessions) {
      const parsed = sessionSyncBatchSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: "invalid_request", details: parsed.error.flatten() },
          { status: 400 }
        );
      }
      sessions = parsed.data.sessions;
    } else {
      const parsed = sessionSyncSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: "invalid_request", details: parsed.error.flatten() },
          { status: 400 }
        );
      }
      sessions = [parsed.data];
    }

    const results = [];
    const errors = [];

    for (const session of sessions) {
      try {
        // Verify device matches token
        if (session.deviceId !== tokenPayload.deviceId) {
          errors.push({
            originalId: session.originalId,
            error: "device_mismatch",
          });
          continue;
        }

        // Upsert session
        const syncedSession = await prisma.syncedSession.upsert({
          where: {
            userId_deviceId_originalId: {
              userId: user.id,
              deviceId: session.deviceId,
              originalId: session.originalId,
            },
          },
          update: {
            title: session.title,
            startTime: new Date(session.startTime),
            endTime: session.endTime ? new Date(session.endTime) : null,
            duration: session.duration,
            transcript: session.transcript,
            summary: session.summary,
            actionItems: session.actionItems,
            modeUsed: session.modeUsed,
            version: session.version,
            checksum: session.checksum,
          },
          create: {
            userId: user.id,
            deviceId: session.deviceId,
            originalId: session.originalId,
            title: session.title,
            startTime: new Date(session.startTime),
            endTime: session.endTime ? new Date(session.endTime) : null,
            duration: session.duration,
            transcript: session.transcript,
            summary: session.summary,
            actionItems: session.actionItems,
            modeUsed: session.modeUsed,
            version: session.version,
            checksum: session.checksum,
          },
        });

        // Sync AI responses if provided
        if (session.aiResponses?.length) {
          for (const aiResponse of session.aiResponses) {
            await prisma.syncedAIResponse.upsert({
              where: {
                id: `${syncedSession.id}-${aiResponse.originalId}`,
              },
              update: {
                type: aiResponse.type,
                content: aiResponse.content,
                provider: aiResponse.provider,
                latencyMs: aiResponse.latencyMs,
                timestamp: new Date(aiResponse.timestamp),
              },
              create: {
                id: `${syncedSession.id}-${aiResponse.originalId}`,
                syncedSessionId: syncedSession.id,
                originalId: aiResponse.originalId,
                type: aiResponse.type,
                content: aiResponse.content,
                provider: aiResponse.provider,
                latencyMs: aiResponse.latencyMs,
                timestamp: new Date(aiResponse.timestamp),
              },
            });
          }
        }

        results.push({
          originalId: session.originalId,
          syncedId: syncedSession.id,
          status: "synced",
        });
      } catch (error) {
        console.error("Session sync error:", error);
        errors.push({
          originalId: session.originalId,
          error: "sync_failed",
        });
      }
    }

    return NextResponse.json({
      synced: results.length,
      failed: errors.length,
      results,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("Sync endpoint error:", error);
    return NextResponse.json(
      { error: "server_error", message: "Sync failed" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/sync/sessions
 * Get sync status and session list
 */
export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "unauthorized" },
        { status: 401 }
      );
    }

    const accessToken = authHeader.slice(7);

    let tokenPayload;
    try {
      tokenPayload = await verifyAccessToken(accessToken);
    } catch {
      return NextResponse.json(
        { error: "invalid_token" },
        { status: 401 }
      );
    }

    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get("limit") || "50");
    const offset = parseInt(url.searchParams.get("offset") || "0");

    const [sessions, count] = await Promise.all([
      prisma.syncedSession.findMany({
        where: {
          userId: tokenPayload.sub,
          deviceId: tokenPayload.deviceId,
        },
        select: {
          id: true,
          originalId: true,
          title: true,
          startTime: true,
          version: true,
          checksum: true,
          updatedAt: true,
        },
        orderBy: { startTime: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.syncedSession.count({
        where: {
          userId: tokenPayload.sub,
          deviceId: tokenPayload.deviceId,
        },
      }),
    ]);

    return NextResponse.json({
      sessions,
      total: count,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Get synced sessions error:", error);
    return NextResponse.json(
      { error: "server_error" },
      { status: 500 }
    );
  }
}
