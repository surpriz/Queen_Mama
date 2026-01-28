import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAccessToken } from "@/lib/device-auth";
import { recordKnowledgeUsage } from "@/lib/knowledge-retrieval";
import { z } from "zod";

// CORS headers for desktop app requests
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

/**
 * OPTIONS /api/feedback
 * Handle preflight CORS requests
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

// Validation schema for feedback
const feedbackSchema = z.object({
  responseId: z.string().optional(),
  sessionId: z.string().optional(),
  isHelpful: z.boolean(),
  atomsUsed: z.array(z.string()).optional().default([]),
});

/**
 * POST /api/feedback
 * Submit feedback on an AI response
 * Updates knowledge atom helpfulness scores
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

    let tokenPayload;
    try {
      tokenPayload = await verifyAccessToken(accessToken);
    } catch {
      return NextResponse.json(
        { error: "invalid_token", message: "Invalid or expired token" },
        { status: 401, headers: corsHeaders }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const parsed = feedbackSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "invalid_request", details: parsed.error.flatten() },
        { status: 400, headers: corsHeaders }
      );
    }

    const { responseId, sessionId, isHelpful, atomsUsed } = parsed.data;

    // Store feedback
    const feedback = await prisma.aIFeedback.create({
      data: {
        userId: tokenPayload.sub,
        responseId,
        sessionId,
        isHelpful,
        atomsUsed,
      },
    });

    // Update knowledge atom scores if atoms were used
    if (atomsUsed.length > 0) {
      // recordKnowledgeUsage already increments usageCount
      // We need to update helpfulCount if helpful
      if (isHelpful) {
        await prisma.knowledgeAtom.updateMany({
          where: {
            id: { in: atomsUsed },
            userId: tokenPayload.sub, // Ensure user owns the atoms
          },
          data: {
            helpfulCount: { increment: 1 },
          },
        });
      }
    }

    console.log(
      `[Feedback] User ${tokenPayload.sub} gave ${isHelpful ? "positive" : "negative"} feedback` +
        (atomsUsed.length > 0 ? ` (${atomsUsed.length} atoms)` : "")
    );

    return NextResponse.json(
      { success: true, feedbackId: feedback.id },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error("Feedback endpoint error:", error);
    return NextResponse.json(
      { error: "server_error", message: "Failed to submit feedback" },
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * GET /api/feedback
 * Get feedback statistics for the user
 */
export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "unauthorized" },
        { status: 401, headers: corsHeaders }
      );
    }

    const accessToken = authHeader.slice(7);

    let tokenPayload;
    try {
      tokenPayload = await verifyAccessToken(accessToken);
    } catch {
      return NextResponse.json(
        { error: "invalid_token" },
        { status: 401, headers: corsHeaders }
      );
    }

    // Get feedback statistics
    const [totalFeedback, positiveFeedback, recentFeedback] = await Promise.all([
      prisma.aIFeedback.count({
        where: { userId: tokenPayload.sub },
      }),
      prisma.aIFeedback.count({
        where: { userId: tokenPayload.sub, isHelpful: true },
      }),
      prisma.aIFeedback.findMany({
        where: { userId: tokenPayload.sub },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          isHelpful: true,
          createdAt: true,
        },
      }),
    ]);

    return NextResponse.json(
      {
        totalFeedback,
        positiveFeedback,
        positiveRate: totalFeedback > 0 ? positiveFeedback / totalFeedback : 0,
        recentFeedback,
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error("Get feedback error:", error);
    return NextResponse.json(
      { error: "server_error" },
      { status: 500, headers: corsHeaders }
    );
  }
}
