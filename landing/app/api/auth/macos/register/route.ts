import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import {
  signAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  AUTH_CONSTANTS,
} from "@/lib/device-auth";
import { macosRegisterSchema } from "@/lib/validations";
import { generateAndSendVerificationEmail } from "@/app/api/auth/verify-email/route";

/**
 * POST /api/auth/macos/register
 * Registration + login atomic operation for macOS app
 * Creates user, subscription, device, and returns tokens in one request
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = macosRegisterSchema.safeParse(body);

    if (!parsed.success) {
      const firstError = parsed.error.issues[0];
      // Check for password-specific errors
      if (firstError.path[0] === "password") {
        return NextResponse.json(
          {
            error: "weak_password",
            message: firstError.message,
            field: "password",
          },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: "validation_error", message: firstError.message },
        { status: 400 }
      );
    }

    const { name, email, password, deviceId, deviceName, platform, osVersion, appVersion } =
      parsed.data;

    const normalizedEmail = email.toLowerCase();

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, password: true },
    });

    if (existingUser) {
      // Check if it's an OAuth user (no password)
      if (!existingUser.password) {
        return NextResponse.json(
          {
            error: "oauth_account_exists",
            message: "This email uses Google or GitHub login. Use 'Connect Account' instead.",
            requiresDeviceCode: true,
          },
          { status: 400 }
        );
      }

      return NextResponse.json(
        {
          error: "email_exists",
          message: "An account with this email already exists. Try signing in instead.",
        },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user, subscription, and device in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create user with subscription
      const user = await tx.user.create({
        data: {
          name,
          email: normalizedEmail,
          password: hashedPassword,
          subscription: {
            create: {
              plan: "FREE",
              status: "ACTIVE",
            },
          },
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
        },
      });

      // Create device
      const device = await tx.device.create({
        data: {
          userId: user.id,
          deviceId,
          name: deviceName,
          platform,
          osVersion,
          appVersion,
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
      await tx.refreshToken.create({
        data: {
          tokenHash: refreshTokenHash,
          userId: user.id,
          deviceId: device.id,
          expiresAt: new Date(
            Date.now() + AUTH_CONSTANTS.REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000
          ),
        },
      });

      return {
        user,
        accessToken,
        refreshToken,
      };
    });

    // Send verification email (non-blocking)
    generateAndSendVerificationEmail(normalizedEmail, name).catch((error) => {
      console.error("Failed to send verification email:", error);
    });

    return NextResponse.json(
      {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        expiresIn: AUTH_CONSTANTS.ACCESS_TOKEN_EXPIRY_SECONDS,
        user: {
          id: result.user.id,
          email: result.user.email,
          name: result.user.name,
        },
        message: "Account created successfully",
        emailVerificationRequired: true,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("macOS registration error:", error);
    return NextResponse.json(
      { error: "server_error", message: "Registration failed. Please try again." },
      { status: 500 }
    );
  }
}
