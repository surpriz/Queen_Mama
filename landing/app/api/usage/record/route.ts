import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAccessToken } from "@/lib/device-auth";
import { usageRecordSchema, usageRecordBatchSchema } from "@/lib/validations";
import { Prisma } from "@prisma/client";

/**
 * POST /api/usage/record
 * Records feature usage from the macOS app for server-side tracking
 * Supports both single record and batch recording
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

    // Check if it's a batch request or single record
    const isBatch = "records" in body && Array.isArray(body.records);

    let records: Array<{
      action: string;
      provider?: string;
      tokensUsed?: number;
      metadata?: Record<string, unknown>;
    }>;

    if (isBatch) {
      const parsed = usageRecordBatchSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: "invalid_request", details: parsed.error.flatten() },
          { status: 400 }
        );
      }
      records = parsed.data.records;
    } else {
      const parsed = usageRecordSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: "invalid_request", details: parsed.error.flatten() },
          { status: 400 }
        );
      }
      records = [parsed.data];
    }

    // Create usage log entries
    const createdRecords = await prisma.usageLog.createMany({
      data: records.map((record) => ({
        userId: tokenPayload.sub,
        action: record.action,
        provider: record.provider ?? null,
        tokensUsed: record.tokensUsed ?? null,
        metadata: record.metadata
          ? (record.metadata as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        createdAt: new Date(),
      })),
    });

    // Get today's updated usage stats
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayUsage = await prisma.usageLog.groupBy({
      by: ["action"],
      where: {
        userId: tokenPayload.sub,
        createdAt: { gte: today },
      },
      _count: { action: true },
    });

    const usageStats = {
      smartModeUsedToday: todayUsage.find((u) => u.action === "smart_mode")?._count.action || 0,
      aiRequestsToday: todayUsage.find((u) => u.action === "ai_request")?._count.action || 0,
      sessionStartsToday: todayUsage.find((u) => u.action === "session_start")?._count.action || 0,
      autoAnswersToday: todayUsage.find((u) => u.action === "auto_answer")?._count.action || 0,
    };

    return NextResponse.json({
      success: true,
      recorded: createdRecords.count,
      usage: usageStats,
    });
  } catch (error) {
    console.error("Usage recording error:", error);
    return NextResponse.json(
      { error: "server_error", message: "Usage recording failed" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/usage/record
 * Returns current day's usage stats
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

    // Get today's usage stats
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayUsage = await prisma.usageLog.groupBy({
      by: ["action"],
      where: {
        userId: tokenPayload.sub,
        createdAt: { gte: today },
      },
      _count: { action: true },
    });

    const usageStats = {
      smartModeUsedToday: todayUsage.find((u) => u.action === "smart_mode")?._count.action || 0,
      aiRequestsToday: todayUsage.find((u) => u.action === "ai_request")?._count.action || 0,
      sessionStartsToday: todayUsage.find((u) => u.action === "session_start")?._count.action || 0,
      autoAnswersToday: todayUsage.find((u) => u.action === "auto_answer")?._count.action || 0,
    };

    return NextResponse.json({
      usage: usageStats,
      date: today.toISOString(),
    });
  } catch (error) {
    console.error("Usage fetch error:", error);
    return NextResponse.json(
      { error: "server_error", message: "Usage fetch failed" },
      { status: 500 }
    );
  }
}
