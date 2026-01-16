import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import {
  signAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  AUTH_CONSTANTS,
} from "@/lib/device-auth";
import { macosLoginSchema } from "@/lib/validations";

/**
 * POST /api/auth/macos/login
 * Direct email/password login for macOS app
 * For users who registered with credentials (not OAuth)
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = macosLoginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { email, password, deviceId, deviceName, platform, osVersion, appVersion } =
      parsed.data;

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: {
        id: true,
        email: true,
        name: true,
        password: true,
        role: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "invalid_credentials", message: "Invalid email or password" },
        { status: 401 }
      );
    }

    // Check if user has password (OAuth users don't)
    if (!user.password) {
      return NextResponse.json(
        {
          error: "oauth_user",
          message: "This account uses social login. Please use the device code flow instead.",
          requiresDeviceCode: true,
        },
        { status: 400 }
      );
    }

    // Check if blocked
    if (user.role === "BLOCKED") {
      return NextResponse.json(
        { error: "account_blocked", message: "Your account has been blocked" },
        { status: 403 }
      );
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return NextResponse.json(
        { error: "invalid_credentials", message: "Invalid email or password" },
        { status: 401 }
      );
    }

    // Check device limit
    const activeDevices = await prisma.device.count({
      where: {
        userId: user.id,
        isActive: true,
      },
    });

    // Find or create device
    let device = await prisma.device.findUnique({
      where: { deviceId },
    });

    if (!device) {
      if (activeDevices >= AUTH_CONSTANTS.MAX_DEVICES_PER_USER) {
        return NextResponse.json(
          {
            error: "device_limit",
            message: "Maximum device limit reached. Please remove a device first.",
            maxDevices: AUTH_CONSTANTS.MAX_DEVICES_PER_USER,
          },
          { status: 403 }
        );
      }

      device = await prisma.device.create({
        data: {
          userId: user.id,
          deviceId,
          name: deviceName,
          platform,
          osVersion,
          appVersion,
        },
      });
    } else {
      // Update existing device
      await prisma.device.update({
        where: { id: device.id },
        data: {
          userId: user.id,
          name: deviceName,
          osVersion,
          appVersion,
          lastSeenAt: new Date(),
          isActive: true,
        },
      });
    }

    // Revoke any existing refresh tokens for this device
    await prisma.refreshToken.updateMany({
      where: {
        deviceId: device.id,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    // Generate tokens
    const accessToken = await signAccessToken({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      deviceId,
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
    console.error("macOS login error:", error);
    return NextResponse.json(
      { error: "server_error", message: "Login failed" },
      { status: 500 }
    );
  }
}
