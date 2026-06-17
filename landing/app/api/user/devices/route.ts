import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { maxDevicesForPlan } from "@/lib/device-auth";

/**
 * GET /api/user/devices
 * List all devices for the authenticated user
 */
export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const [devices, subscription] = await Promise.all([
      prisma.device.findMany({
        where: {
          userId: session.user.id,
        },
        select: {
          id: true,
          name: true,
          platform: true,
          osVersion: true,
          appVersion: true,
          lastSeenAt: true,
          createdAt: true,
          isActive: true,
        },
        orderBy: {
          lastSeenAt: "desc",
        },
      }),
      prisma.subscription.findUnique({
        where: { userId: session.user.id },
        select: { plan: true },
      }),
    ]);

    return NextResponse.json({
      devices,
      count: devices.length,
      maxDevices: maxDevicesForPlan(subscription?.plan),
    });
  } catch (error) {
    console.error("List devices error:", error);
    return NextResponse.json(
      { error: "Failed to list devices" },
      { status: 500 }
    );
  }
}
