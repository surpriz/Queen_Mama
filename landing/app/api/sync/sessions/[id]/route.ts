import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { verifyAccessToken } from "@/lib/device-auth";

/**
 * DELETE /api/sync/sessions/[id]
 * Delete a synced session.
 * Supports both NextAuth session (web) and Bearer token (Mac app) authentication.
 *
 * For Mac app: id can be either the synced session ID or the originalId
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    let userId: string;

    // Try Bearer token auth first (Mac app)
    const authHeader = request.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const accessToken = authHeader.slice(7);
      try {
        const tokenPayload = await verifyAccessToken(accessToken);
        userId = tokenPayload.sub;
      } catch {
        return NextResponse.json(
          { error: "invalid_token", message: "Invalid or expired token" },
          { status: 401 }
        );
      }
    } else {
      // Fall back to NextAuth session (web)
      const session = await auth();
      if (!session?.user?.id) {
        return NextResponse.json(
          { error: "unauthorized", message: "Please sign in to delete sessions" },
          { status: 401 }
        );
      }
      userId = session.user.id;
    }

    // Find the session - try by ID first, then by originalId
    let syncedSession = await prisma.syncedSession.findUnique({
      where: { id },
      select: { id: true, userId: true, title: true, originalId: true },
    });

    // If not found by ID, try by originalId (Mac app sends originalId)
    if (!syncedSession) {
      syncedSession = await prisma.syncedSession.findFirst({
        where: { originalId: id, userId },
        select: { id: true, userId: true, title: true, originalId: true },
      });
    }

    if (!syncedSession) {
      return NextResponse.json(
        { error: "not_found", message: "Session not found" },
        { status: 404 }
      );
    }

    // Verify the session belongs to the authenticated user
    if (syncedSession.userId !== userId) {
      return NextResponse.json(
        { error: "forbidden", message: "You cannot delete this session" },
        { status: 403 }
      );
    }

    // Delete the session (aiResponses will be cascade deleted via Prisma relation)
    await prisma.syncedSession.delete({
      where: { id: syncedSession.id },
    });

    return NextResponse.json({
      success: true,
      message: "Session deleted successfully",
      deletedId: syncedSession.id,
      originalId: syncedSession.originalId,
    });
  } catch (error) {
    console.error("Delete session error:", error);
    return NextResponse.json(
      { error: "server_error", message: "Failed to delete session" },
      { status: 500 }
    );
  }
}
