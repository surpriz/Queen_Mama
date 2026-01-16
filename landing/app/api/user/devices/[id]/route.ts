import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/user/devices/[id]
 * Get details of a specific device
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = await params;

    const device = await prisma.device.findFirst({
      where: {
        id,
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
    });

    if (!device) {
      return NextResponse.json(
        { error: "Device not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(device);
  } catch (error) {
    console.error("Get device error:", error);
    return NextResponse.json(
      { error: "Failed to get device" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/user/devices/[id]
 * Update device (rename or deactivate)
 */
export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { name, isActive } = body;

    // Verify ownership
    const device = await prisma.device.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!device) {
      return NextResponse.json(
        { error: "Device not found" },
        { status: 404 }
      );
    }

    // Build update data
    const updateData: { name?: string; isActive?: boolean } = {};
    if (typeof name === "string" && name.trim()) {
      updateData.name = name.trim();
    }
    if (typeof isActive === "boolean") {
      updateData.isActive = isActive;

      // If deactivating, revoke all refresh tokens
      if (!isActive) {
        await prisma.refreshToken.updateMany({
          where: {
            deviceId: device.id,
            revokedAt: null,
          },
          data: {
            revokedAt: new Date(),
          },
        });
      }
    }

    const updatedDevice = await prisma.device.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        platform: true,
        isActive: true,
        lastSeenAt: true,
      },
    });

    return NextResponse.json(updatedDevice);
  } catch (error) {
    console.error("Update device error:", error);
    return NextResponse.json(
      { error: "Failed to update device" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/user/devices/[id]
 * Remove a device and revoke all its tokens
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = await params;

    // Verify ownership
    const device = await prisma.device.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!device) {
      return NextResponse.json(
        { error: "Device not found" },
        { status: 404 }
      );
    }

    // Delete device (cascade will delete refresh tokens)
    await prisma.device.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: "Device removed successfully",
    });
  } catch (error) {
    console.error("Delete device error:", error);
    return NextResponse.json(
      { error: "Failed to delete device" },
      { status: 500 }
    );
  }
}
