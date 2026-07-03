import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import {
  verifyAccessToken,
  signAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  AUTH_CONSTANTS,
} from "@/lib/device-auth";
import { anonymousUpgradeSchema } from "@/lib/validations";
import {
  checkRateLimit,
  getIdentifier,
  rateLimitResponse,
  rateLimitConfigs,
} from "@/lib/rate-limit";

/**
 * POST /api/auth/anonymous/upgrade
 * Converts the caller's anonymous account into a real credentials account,
 * keeping the SAME user id so sessions, devices, contacts, knowledge etc. carry
 * over. Requires the anonymous access token as Bearer. Returns a fresh token
 * pair (the old email claim is now stale).
 */
export async function POST(request: Request) {
  try {
    const rl = checkRateLimit(getIdentifier(request), rateLimitConfigs.auth);
    if (!rl.success) return rateLimitResponse(rl);

    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "unauthorized", message: "Missing authorization header" },
        { status: 401 }
      );
    }

    let tokenPayload;
    try {
      tokenPayload = await verifyAccessToken(authHeader.slice(7));
    } catch {
      return NextResponse.json(
        { error: "invalid_token", message: "Invalid or expired token" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const parsed = anonymousUpgradeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { name, email, password } = parsed.data;
    const normalizedEmail = email.toLowerCase();

    const user = await prisma.user.findUnique({
      where: { id: tokenPayload.sub },
      select: { id: true, isAnonymous: true },
    });
    if (!user) {
      return NextResponse.json({ error: "user_not_found" }, { status: 404 });
    }
    if (!user.isAnonymous) {
      return NextResponse.json(
        { error: "already_registered", message: "This account is already registered." },
        { status: 409 }
      );
    }

    // Reject if the email is taken by a different user.
    const emailOwner = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });
    if (emailOwner && emailOwner.id !== user.id) {
      return NextResponse.json(
        { error: "email_taken", message: "An account with this email already exists." },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        email: normalizedEmail,
        password: passwordHash,
        isAnonymous: false,
        ...(name ? { name } : {}),
      },
      select: { id: true, email: true, name: true, role: true },
    });

    // Rotate tokens for the caller's device (email claim changed).
    const deviceId = tokenPayload.deviceId;
    const device = await prisma.device.findUnique({ where: { deviceId } });
    if (device) {
      await prisma.refreshToken.updateMany({
        where: { deviceId: device.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    const accessToken = await signAccessToken({
      userId: updated.id,
      email: updated.email,
      name: updated.name,
      role: updated.role,
      deviceId,
    });

    const refreshToken = generateRefreshToken();
    if (device) {
      await prisma.refreshToken.create({
        data: {
          tokenHash: hashRefreshToken(refreshToken),
          userId: updated.id,
          deviceId: device.id,
          expiresAt: new Date(
            Date.now() + AUTH_CONSTANTS.REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000
          ),
        },
      });
    }

    return NextResponse.json({
      accessToken,
      refreshToken,
      expiresIn: AUTH_CONSTANTS.ACCESS_TOKEN_EXPIRY_SECONDS,
      user: {
        id: updated.id,
        email: updated.email,
        name: updated.name,
        authMethod: "credentials",
        isAnonymous: false,
      },
    });
  } catch (error) {
    console.error("anonymous upgrade error:", error);
    return NextResponse.json(
      { error: "server_error", message: "Upgrade failed" },
      { status: 500 }
    );
  }
}
