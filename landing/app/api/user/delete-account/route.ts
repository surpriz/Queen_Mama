import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const deleteAccountSchema = z.object({
  confirmation: z.literal("DELETE MY ACCOUNT"),
  reason: z.string().optional(),
  immediate: z.boolean().optional().default(false),
});

/**
 * POST /api/user/delete-account
 * Request account deletion (GDPR right to erasure)
 *
 * By default, schedules deletion for 30 days (grace period).
 * Set immediate: true to delete immediately.
 */
export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Parse and validate request body
    const body = await request.json();
    const parsed = deleteAccountSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid request",
          details: "You must type 'DELETE MY ACCOUNT' to confirm deletion",
        },
        { status: 400 }
      );
    }

    const { reason, immediate } = parsed.data;

    // Get user
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { subscription: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Check if user has active paid subscription
    if (
      user.subscription?.status === "ACTIVE" &&
      user.subscription?.plan !== "FREE" &&
      !user.subscription?.cancelAtPeriodEnd
    ) {
      return NextResponse.json(
        {
          error: "Active subscription",
          message:
            "Please cancel your subscription before deleting your account. You can do this in the billing settings.",
        },
        { status: 400 }
      );
    }

    if (immediate) {
      // Immediate deletion
      await deleteUserData(userId, reason);

      return NextResponse.json({
        message: "Your account has been deleted",
        deletedAt: new Date().toISOString(),
      });
    } else {
      // Schedule deletion for 30 days
      const scheduledDeletionDate = new Date(
        Date.now() + 30 * 24 * 60 * 60 * 1000
      );

      // Store deletion request (you could use a separate table for this)
      // For now, we'll mark the user as pending deletion by setting a custom field
      // Note: In production, you'd want a proper scheduled job system
      await prisma.user.update({
        where: { id: userId },
        data: {
          // Store metadata about scheduled deletion
          // This could be a separate table in production
          updatedAt: new Date(),
        },
      });

      // Create a verification token to store the deletion request
      // This allows the user to cancel within the grace period
      await prisma.verificationToken.create({
        data: {
          identifier: `account-deletion:${user.email}`,
          token: userId, // Store userId as token for lookup
          expires: scheduledDeletionDate,
        },
      });

      // Log the deletion request
      console.log(`[GDPR] Account deletion scheduled for user ${userId}`, {
        email: user.email,
        scheduledFor: scheduledDeletionDate.toISOString(),
        reason,
      });

      return NextResponse.json({
        message: "Account deletion scheduled",
        scheduledFor: scheduledDeletionDate.toISOString(),
        cancelBefore: scheduledDeletionDate.toISOString(),
        note: "You can cancel this request by signing in before the deletion date.",
      });
    }
  } catch (error) {
    console.error("Delete account error:", error);
    return NextResponse.json(
      { error: "Failed to process deletion request" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/user/delete-account
 * Cancel a scheduled account deletion
 */
export async function DELETE() {
  try {
    const session = await auth();

    if (!session?.user?.id || !session?.user?.email) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Find and delete the scheduled deletion request
    const deletionRequest = await prisma.verificationToken.findFirst({
      where: {
        identifier: `account-deletion:${session.user.email}`,
      },
    });

    if (!deletionRequest) {
      return NextResponse.json(
        { error: "No pending deletion request found" },
        { status: 404 }
      );
    }

    await prisma.verificationToken.delete({
      where: {
        identifier_token: {
          identifier: deletionRequest.identifier,
          token: deletionRequest.token,
        },
      },
    });

    console.log(`[GDPR] Account deletion cancelled for user ${session.user.id}`);

    return NextResponse.json({
      message: "Account deletion cancelled",
      cancelledAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Cancel deletion error:", error);
    return NextResponse.json(
      { error: "Failed to cancel deletion" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/user/delete-account
 * Check deletion status
 */
export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id || !session?.user?.email) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Check for pending deletion request
    const deletionRequest = await prisma.verificationToken.findFirst({
      where: {
        identifier: `account-deletion:${session.user.email}`,
        expires: { gt: new Date() },
      },
    });

    if (deletionRequest) {
      return NextResponse.json({
        scheduled: true,
        scheduledFor: deletionRequest.expires.toISOString(),
        canCancel: true,
      });
    }

    return NextResponse.json({
      scheduled: false,
    });
  } catch (error) {
    console.error("Check deletion status error:", error);
    return NextResponse.json(
      { error: "Failed to check deletion status" },
      { status: 500 }
    );
  }
}

/**
 * Delete all user data (cascade delete)
 */
async function deleteUserData(userId: string, reason?: string): Promise<void> {
  console.log(`[GDPR] Starting immediate deletion for user ${userId}`, { reason });

  // Delete in order to handle foreign key constraints
  await prisma.$transaction([
    // Delete synced AI responses (via cascade from sessions)
    prisma.syncedAIResponse.deleteMany({
      where: { syncedSession: { userId } },
    }),

    // Delete synced sessions
    prisma.syncedSession.deleteMany({
      where: { userId },
    }),

    // Delete usage logs
    prisma.usageLog.deleteMany({
      where: { userId },
    }),

    // Delete invoices (via cascade from subscription)
    prisma.invoice.deleteMany({
      where: { subscription: { userId } },
    }),

    // Delete subscription
    prisma.subscription.deleteMany({
      where: { userId },
    }),

    // Delete API keys
    prisma.apiKey.deleteMany({
      where: { userId },
    }),

    // Delete refresh tokens
    prisma.refreshToken.deleteMany({
      where: { userId },
    }),

    // Delete devices
    prisma.device.deleteMany({
      where: { userId },
    }),

    // Delete sessions
    prisma.session.deleteMany({
      where: { userId },
    }),

    // Delete accounts (OAuth)
    prisma.account.deleteMany({
      where: { userId },
    }),

    // Delete verification tokens
    prisma.verificationToken.deleteMany({
      where: { identifier: { contains: userId } },
    }),

    // Finally, delete the user
    prisma.user.delete({
      where: { id: userId },
    }),
  ]);

  console.log(`[GDPR] User ${userId} data deleted successfully`);
}
