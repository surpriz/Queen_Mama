import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashRefreshToken, verifyAccessToken } from "@/lib/device-auth";
import { macosLogoutSchema } from "@/lib/validations";

/**
 * POST /api/auth/macos/logout
 * Logout from device - revokes refresh token
 * Optionally revokes all devices
 */
export async function POST(request: Request) {
  try {
    // Get access token from Authorization header
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "unauthorized", message: "Missing authorization header" },
        { status: 401 }
      );
    }

    const accessToken = authHeader.slice(7);

    let tokenPayload;
    try {
      tokenPayload = await verifyAccessToken(accessToken);
    } catch {
      // Even if token is expired, try to logout using refresh token
      tokenPayload = null;
    }

    const body = await request.json();
    const parsed = macosLogoutSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "invalid_request" },
        { status: 400 }
      );
    }

    const { refreshToken, allDevices } = parsed.data;

    if (allDevices && tokenPayload?.sub) {
      // Revoke all refresh tokens for this user
      await prisma.refreshToken.updateMany({
        where: {
          userId: tokenPayload.sub,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      });

      return NextResponse.json({
        success: true,
        message: "Logged out from all devices",
      });
    }

    if (refreshToken) {
      // Revoke specific refresh token
      const tokenHash = hashRefreshToken(refreshToken);

      await prisma.refreshToken.updateMany({
        where: {
          tokenHash,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      });

      return NextResponse.json({
        success: true,
        message: "Logged out successfully",
      });
    }

    // If no refresh token provided but we have device info from access token
    if (tokenPayload?.deviceId && tokenPayload?.sub) {
      const device = await prisma.device.findUnique({
        where: { deviceId: tokenPayload.deviceId },
      });

      if (device) {
        await prisma.refreshToken.updateMany({
          where: {
            deviceId: device.id,
            userId: tokenPayload.sub,
            revokedAt: null,
          },
          data: {
            revokedAt: new Date(),
          },
        });
      }

      return NextResponse.json({
        success: true,
        message: "Logged out successfully",
      });
    }

    return NextResponse.json({
      success: true,
      message: "Logout processed",
    });
  } catch (error) {
    console.error("Logout error:", error);
    return NextResponse.json(
      { error: "server_error", message: "Logout failed" },
      { status: 500 }
    );
  }
}
