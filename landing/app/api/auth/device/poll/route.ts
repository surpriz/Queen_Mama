import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  signAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  AUTH_CONSTANTS,
} from "@/lib/device-auth";
import { deviceCodePollSchema } from "@/lib/validations";

/**
 * GET /api/auth/device/poll?deviceCode=xxx
 * macOS app polls this endpoint to check if user has authorized
 */
export async function GET(request: NextRequest) {
  try {
    const deviceCode = request.nextUrl.searchParams.get("deviceCode");

    const parsed = deviceCodePollSchema.safeParse({ deviceCode });
    if (!parsed.success) {
      return NextResponse.json(
        { error: "authorization_pending" },
        { status: 400 }
      );
    }

    const authCode = await prisma.deviceAuthCode.findUnique({
      where: { deviceCode: parsed.data.deviceCode },
    });

    if (!authCode) {
      return NextResponse.json(
        { error: "expired_token", message: "Code not found or expired" },
        { status: 400 }
      );
    }

    // Check if expired
    if (authCode.expiresAt < new Date()) {
      await prisma.deviceAuthCode.delete({
        where: { id: authCode.id },
      });
      return NextResponse.json(
        { error: "expired_token", message: "Code has expired" },
        { status: 400 }
      );
    }

    // Check if not yet authorized
    if (!authCode.authorizedAt || !authCode.userId) {
      return NextResponse.json(
        { error: "authorization_pending" },
        { status: 202 }
      );
    }

    // Code has been authorized - fetch user and generate tokens
    const user = await prisma.user.findUnique({
      where: { id: authCode.userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
    });

    if (!user) {
      console.error("[Device Poll] User not found for userId:", authCode.userId);
      return NextResponse.json(
        { error: "access_denied", message: "User not found" },
        { status: 403 }
      );
    }

    console.log("[Device Poll] User found:", { id: user.id, email: user.email, role: user.role });

    if (user.role === "BLOCKED") {
      console.error("[Device Poll] User is blocked:", user.email);
      return NextResponse.json(
        { error: "access_denied", message: "Account has been blocked" },
        { status: 403 }
      );
    }

    // Find or create device record
    let device = await prisma.device.findUnique({
      where: { deviceId: authCode.deviceId },
    });

    if (!device) {
      device = await prisma.device.create({
        data: {
          userId: user.id,
          deviceId: authCode.deviceId,
          name: authCode.deviceName || "Mac",
          platform: authCode.platform || "macOS",
        },
      });
    } else {
      // Update device to new user if it was previously registered
      await prisma.device.update({
        where: { id: device.id },
        data: {
          userId: user.id,
          lastSeenAt: new Date(),
          isActive: true,
        },
      });
    }

    // Generate tokens
    const accessToken = await signAccessToken({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      deviceId: authCode.deviceId,
    });

    const refreshToken = generateRefreshToken();
    const refreshTokenHash = hashRefreshToken(refreshToken);

    // Store refresh token
    await prisma.refreshToken.create({
      data: {
        tokenHash: refreshTokenHash,
        userId: user.id,
        deviceId: device.id,
        expiresAt: new Date(
          Date.now() + AUTH_CONSTANTS.REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000
        ),
      },
    });

    // Delete the used auth code
    await prisma.deviceAuthCode.delete({
      where: { id: authCode.id },
    });

    return NextResponse.json({
      accessToken,
      refreshToken,
      expiresIn: AUTH_CONSTANTS.ACCESS_TOKEN_EXPIRY_SECONDS,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    });
  } catch (error) {
    console.error("Device poll error:", error);
    return NextResponse.json(
      { error: "server_error" },
      { status: 500 }
    );
  }
}
