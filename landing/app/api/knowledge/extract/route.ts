import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { extractKnowledgeFromSession } from "@/lib/knowledge-extraction";
import { z } from "zod";

const extractSchema = z.object({
  sessionId: z.string(),
});

/**
 * POST /api/knowledge/extract
 * Manually trigger knowledge extraction for a session
 */
export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    // Check if user is Enterprise
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { subscription: true },
    });

    if (user?.subscription?.plan !== "ENTERPRISE") {
      return NextResponse.json(
        { error: "enterprise_required", message: "Knowledge extraction requires Enterprise subscription" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = extractSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "invalid_request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Fetch the session and verify ownership
    const syncedSession = await prisma.syncedSession.findFirst({
      where: {
        id: parsed.data.sessionId,
        userId: session.user.id,
      },
      select: {
        id: true,
        title: true,
        transcript: true,
      },
    });

    if (!syncedSession) {
      return NextResponse.json(
        { error: "not_found", message: "Session not found" },
        { status: 404 }
      );
    }

    if (!syncedSession.transcript || syncedSession.transcript.length < 100) {
      return NextResponse.json(
        { error: "invalid_session", message: "Session transcript too short for extraction" },
        { status: 400 }
      );
    }

    // Run extraction
    const result = await extractKnowledgeFromSession(
      syncedSession.id,
      session.user.id,
      syncedSession.transcript
    );

    return NextResponse.json({
      success: true,
      sessionId: syncedSession.id,
      sessionTitle: syncedSession.title,
      atomsCreated: result.atomsCreated,
      errors: result.errors.length > 0 ? result.errors : undefined,
    });
  } catch (error) {
    console.error("Extract knowledge error:", error);
    return NextResponse.json(
      { error: "server_error" },
      { status: 500 }
    );
  }
}
