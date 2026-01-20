import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { forgotPasswordSchema } from "@/lib/validations";
import { sendPasswordResetEmail } from "@/lib/email";
import { checkRateLimit, getIdentifier, rateLimitResponse, rateLimitConfigs, addRateLimitHeaders } from "@/lib/rate-limit";
import crypto from "crypto";

export async function POST(request: Request) {
  // Apply strict rate limiting for password reset
  const identifier = getIdentifier(request);
  const rateLimitResult = checkRateLimit(identifier, rateLimitConfigs.passwordReset);

  if (!rateLimitResult.success) {
    return rateLimitResponse(rateLimitResult);
  }
  try {
    const body = await request.json();

    const parsed = forgotPasswordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { email } = parsed.data;

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true, email: true, password: true },
    });

    // Always return success to prevent email enumeration attacks
    if (!user || !user.password) {
      // User doesn't exist or uses OAuth only
      return NextResponse.json({
        message: "If an account exists with this email, you will receive a password reset link.",
      });
    }

    // Generate secure token
    const token = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    // Delete any existing password reset tokens for this user
    await prisma.verificationToken.deleteMany({
      where: {
        identifier: `password-reset:${user.email}`,
      },
    });

    // Create new token (expires in 1 hour)
    await prisma.verificationToken.create({
      data: {
        identifier: `password-reset:${user.email}`,
        token: hashedToken,
        expires: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      },
    });

    // Send password reset email
    await sendPasswordResetEmail(
      user.email,
      user.name || "there",
      token // Send unhashed token in email
    );

    const response = NextResponse.json({
      message: "If an account exists with this email, you will receive a password reset link.",
    });
    return addRateLimitHeaders(response, rateLimitResult, rateLimitConfigs.passwordReset.maxRequests);
  } catch (error) {
    console.error("Forgot password error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
