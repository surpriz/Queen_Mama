import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import {
  signAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  AUTH_CONSTANTS,
} from "@/lib/device-auth";
import { anonymousAuthSchema } from "@/lib/validations";
import {
  checkRateLimit,
  getIdentifier,
  rateLimitResponse,
  rateLimitConfigs,
} from "@/lib/rate-limit";

/**
 * POST /api/auth/anonymous
 * Creates a no-signup "guest" account so the app is usable immediately.
 * The guest is a real FREE user (synthetic email), so all existing tier/config
 * logic works unchanged. Convert to a real account later via /anonymous/upgrade
 * (same user id → sessions, devices and data carry over).
 */
export async function POST(request: Request) {
  try {
    // Rate limit anonymous creation by IP to prevent abuse.
    const rl = checkRateLimit(getIdentifier(request), rateLimitConfigs.auth);
    if (!rl.success) return rateLimitResponse(rl);

    const body = await request.json();
    const parsed = anonymousAuthSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { deviceId, deviceName, platform, osVersion, appVersion } = parsed.data;

    // If this device is already known, reuse its user rather than spawning a
    // duplicate guest (the app may re-call this after losing its tokens).
    const existingDevice = await prisma.device.findUnique({
      where: { deviceId },
      include: {
        user: { select: { id: true, email: true, name: true, role: true, isAnonymous: true } },
      },
    });

    if (existingDevice && !existingDevice.user.isAnonymous) {
      // Device belongs to a real account — don't hand out an anonymous session.
      return NextResponse.json(
        { error: "device_registered", message: "This device is linked to an account. Please sign in." },
        { status: 409 }
      );
    }

    let user: { id: string; email: string; name: string | null; role: string };
    let deviceRowId: string;

    if (existingDevice) {
      user = existingDevice.user;
      deviceRowId = existingDevice.id;
      await prisma.device.update({
        where: { id: existingDevice.id },
        data: { name: deviceName, osVersion, appVersion, lastSeenAt: new Date(), isActive: true },
      });
    } else {
      const email = `anon-${crypto.randomUUID()}@anon.queenmama.co`;
      const created = await prisma.$transaction(async (tx) => {
        // No Subscription row: config/license default to FREE when absent.
        const u = await tx.user.create({
          data: { email, name: "Guest", isAnonymous: true },
          select: { id: true, email: true, name: true, role: true },
        });
        const d = await tx.device.create({
          data: { userId: u.id, deviceId, name: deviceName, platform, osVersion, appVersion },
        });
        return { u, d };
      });
      user = created.u;
      deviceRowId = created.d.id;
    }

    // Fresh token pair for this device (revoke any prior ones first).
    await prisma.refreshToken.updateMany({
      where: { deviceId: deviceRowId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    const accessToken = await signAccessToken({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      deviceId,
    });

    const refreshToken = generateRefreshToken();
    await prisma.refreshToken.create({
      data: {
        tokenHash: hashRefreshToken(refreshToken),
        userId: user.id,
        deviceId: deviceRowId,
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
        authMethod: "anonymous",
        isAnonymous: true,
      },
    });
  } catch (error) {
    console.error("anonymous auth error:", error);
    return NextResponse.json(
      { error: "server_error", message: "Failed to create anonymous session" },
      { status: 500 }
    );
  }
}
