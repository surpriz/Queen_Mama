import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { deviceAuthorizeSchema } from "@/lib/validations";

/**
 * POST /api/auth/device/authorize
 * User authorizes a device by entering the user code on the web
 * Requires authenticated session
 */
export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Please sign in first" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const parsed = deviceAuthorizeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid code format", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { userCode } = parsed.data;

    // Find the pending auth code
    const authCode = await prisma.deviceAuthCode.findUnique({
      where: { userCode: userCode.toUpperCase() },
    });

    if (!authCode) {
      return NextResponse.json(
        { error: "Code not found", message: "This code doesn't exist or has expired" },
        { status: 404 }
      );
    }

    // Check if already authorized
    if (authCode.authorizedAt) {
      return NextResponse.json(
        { error: "Already authorized", message: "This code has already been used" },
        { status: 409 }
      );
    }

    // Check if expired
    if (authCode.expiresAt < new Date()) {
      await prisma.deviceAuthCode.delete({
        where: { id: authCode.id },
      });
      return NextResponse.json(
        { error: "Code expired", message: "This code has expired. Please generate a new one." },
        { status: 410 }
      );
    }

    // Check max devices limit
    const deviceCount = await prisma.device.count({
      where: {
        userId: session.user.id,
        isActive: true,
      },
    });

    if (deviceCount >= 5) {
      return NextResponse.json(
        {
          error: "Device limit reached",
          message: "You have reached the maximum number of devices (5). Please remove a device first.",
        },
        { status: 403 }
      );
    }

    // Authorize the device
    await prisma.deviceAuthCode.update({
      where: { id: authCode.id },
      data: {
        userId: session.user.id,
        authorizedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: "Device authorized successfully",
      deviceName: authCode.deviceName,
    });
  } catch (error) {
    console.error("Device authorization error:", error);
    return NextResponse.json(
      { error: "Authorization failed" },
      { status: 500 }
    );
  }
}
