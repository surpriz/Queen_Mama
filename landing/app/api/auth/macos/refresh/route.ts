import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  signAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  verifyRefreshToken,
  AUTH_CONSTANTS,
} from "@/lib/device-auth";
import { macosRefreshSchema } from "@/lib/validations";

// CORS headers for desktop app requests
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

/**
 * OPTIONS /api/auth/macos/refresh
 * Handle preflight CORS requests
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

/**
 * POST /api/auth/macos/refresh
 * Refresh access token using refresh token
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = macosRefreshSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "invalid_request", message: "Refresh token is required" },
        { status: 400, headers: corsHeaders }
      );
    }

    const { refreshToken } = parsed.data;
    const tokenHash = hashRefreshToken(refreshToken);

    // Find the refresh token
    const storedToken = await prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
          },
        },
        device: {
          select: {
            id: true,
            deviceId: true,
            isActive: true,
          },
        },
      },
    });

    if (!storedToken) {
      return NextResponse.json(
        { error: "invalid_token", message: "Invalid refresh token" },
        { status: 401, headers: corsHeaders }
      );
    }

    // Check if revoked
    if (storedToken.revokedAt) {
      return NextResponse.json(
        { error: "token_revoked", message: "Token has been revoked" },
        { status: 401, headers: corsHeaders }
      );
    }

    // Check if expired
    if (storedToken.expiresAt < new Date()) {
      return NextResponse.json(
        { error: "token_expired", message: "Refresh token has expired" },
        { status: 401, headers: corsHeaders }
      );
    }

    // Check if device is still active
    if (!storedToken.device.isActive) {
      return NextResponse.json(
        { error: "device_inactive", message: "Device has been deactivated" },
        { status: 401, headers: corsHeaders }
      );
    }

    // Check if user is blocked
    if (storedToken.user.role === "BLOCKED") {
      return NextResponse.json(
        { error: "account_blocked", message: "Account has been blocked" },
        { status: 403, headers: corsHeaders }
      );
    }

    // Rotate refresh token (security best practice)
    const newRefreshToken = generateRefreshToken();
    const newRefreshTokenHash = hashRefreshToken(newRefreshToken);

    // Revoke old token and create new one in a transaction
    await prisma.$transaction([
      prisma.refreshToken.update({
        where: { id: storedToken.id },
        data: { revokedAt: new Date() },
      }),
      prisma.refreshToken.create({
        data: {
          tokenHash: newRefreshTokenHash,
          userId: storedToken.userId,
          deviceId: storedToken.device.id,
          expiresAt: new Date(
            Date.now() + AUTH_CONSTANTS.REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000
          ),
        },
      }),
      prisma.device.update({
        where: { id: storedToken.device.id },
        data: { lastSeenAt: new Date() },
      }),
    ]);

    // Generate new access token
    const accessToken = await signAccessToken({
      userId: storedToken.user.id,
      email: storedToken.user.email,
      name: storedToken.user.name,
      role: storedToken.user.role,
      deviceId: storedToken.device.deviceId,
    });

    return NextResponse.json(
      {
        accessToken,
        refreshToken: newRefreshToken,
        expiresIn: AUTH_CONSTANTS.ACCESS_TOKEN_EXPIRY_SECONDS,
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error("Token refresh error:", error);
    return NextResponse.json(
      { error: "server_error", message: "Token refresh failed" },
      { status: 500, headers: corsHeaders }
    );
  }
}
