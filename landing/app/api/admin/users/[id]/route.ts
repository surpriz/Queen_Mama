import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { logAdminAction } from "@/lib/audit";
import { getStripe } from "@/lib/stripe";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify admin authentication
    const admin = await requireAdmin();
    const { id } = await params;

    // Prevent admin from deleting themselves
    if (admin.id === id) {
      return NextResponse.json(
        { error: "Cannot delete your own account" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        stripeCustomerId: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Log the action before deletion
    await logAdminAction(admin.id, "USER_DELETED", {
      targetUserId: id,
      targetUserEmail: user.email,
      targetUserName: user.name,
      targetUserRole: user.role,
    });

    // Clean up records not covered by Prisma cascades (no FK relation to User).
    // Reassign AdminApiKey.createdBy to the acting admin so system keys keep working.
    await prisma.$transaction([
      prisma.deviceAuthCode.deleteMany({ where: { userId: id } }),
      prisma.adminApiKey.updateMany({
        where: { createdBy: id },
        data: { createdBy: admin.id },
      }),
      ...(user.email
        ? [
            prisma.verificationToken.deleteMany({
              where: { identifier: user.email },
            }),
            prisma.waitlist.deleteMany({ where: { email: user.email } }),
          ]
        : []),
      prisma.user.delete({ where: { id } }),
    ]);

    // Delete the Stripe Customer (best-effort; non-blocking).
    if (user.stripeCustomerId) {
      try {
        await getStripe().customers.del(user.stripeCustomerId);
      } catch (stripeError) {
        console.error(
          `Failed to delete Stripe customer ${user.stripeCustomerId} for user ${id}:`,
          stripeError
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Unauthorized") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      if (error.message === "Forbidden") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    console.error("Error deleting user:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
