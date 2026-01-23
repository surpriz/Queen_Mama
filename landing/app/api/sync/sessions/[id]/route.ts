import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

/**
 * DELETE /api/sync/sessions/[id]
 * Delete a synced session from the web dashboard.
 * Uses NextAuth session authentication (web-only, not Bearer token).
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "unauthorized", message: "Please sign in to delete sessions" },
        { status: 401 }
      );
    }

    const { id } = await params;

    // Find the session and verify ownership
    const syncedSession = await prisma.syncedSession.findUnique({
      where: { id },
      select: { id: true, userId: true, title: true },
    });

    if (!syncedSession) {
      return NextResponse.json(
        { error: "not_found", message: "Session not found" },
        { status: 404 }
      );
    }

    // Verify the session belongs to the authenticated user
    if (syncedSession.userId !== session.user.id) {
      return NextResponse.json(
        { error: "forbidden", message: "You cannot delete this session" },
        { status: 403 }
      );
    }

    // Delete the session (aiResponses will be cascade deleted via Prisma relation)
    await prisma.syncedSession.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: "Session deleted successfully",
      deletedId: id,
    });
  } catch (error) {
    console.error("Delete session error:", error);
    return NextResponse.json(
      { error: "server_error", message: "Failed to delete session" },
      { status: 500 }
    );
  }
}
