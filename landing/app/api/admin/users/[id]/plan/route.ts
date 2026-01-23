import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { logAdminAction } from "@/lib/audit";
import { updateUserPlanSchema } from "@/lib/validations";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify admin authentication
    const admin = await requireAdmin();
    const { id } = await params;

    // Parse and validate request body
    const body = await request.json();
    const validation = updateUserPlanSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: validation.error },
        { status: 400 }
      );
    }

    const { plan, status } = validation.data;

    // Get current user info before update
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        subscription: {
          select: {
            id: true,
            plan: true,
            status: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const oldPlan = user.subscription?.plan || "FREE";
    const oldStatus = user.subscription?.status || "ACTIVE";

    // Update or create subscription
    const subscription = await prisma.subscription.upsert({
      where: { userId: id },
      update: {
        plan,
        status: status || "ACTIVE",
      },
      create: {
        userId: id,
        plan,
        status: status || "ACTIVE",
      },
    });

    // Log the action
    await logAdminAction(admin.id, "PLAN_CHANGED", {
      targetUserId: id,
      targetUserEmail: user.email,
      targetUserName: user.name,
      oldPlan,
      newPlan: plan,
      oldStatus,
      newStatus: status || "ACTIVE",
    });

    return NextResponse.json({
      success: true,
      subscription: {
        plan: subscription.plan,
        status: subscription.status,
      },
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

    console.error("Error updating user plan:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
