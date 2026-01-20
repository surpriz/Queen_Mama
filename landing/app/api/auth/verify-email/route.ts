import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendVerificationEmail } from "@/lib/email";
import crypto from "crypto";
import { auth } from "@/lib/auth";

// GET - Verify email with token
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json(
        { error: "Token is required", verified: false },
        { status: 400 }
      );
    }

    // Hash the token to compare with stored hash
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    // Find the token in the database
    const verificationToken = await prisma.verificationToken.findFirst({
      where: {
        token: hashedToken,
        identifier: { startsWith: "email-verify:" },
        expires: { gt: new Date() },
      },
    });

    if (!verificationToken) {
      return NextResponse.json(
        { error: "Invalid or expired verification token", verified: false },
        { status: 400 }
      );
    }

    // Extract email from identifier
    const email = verificationToken.identifier.replace("email-verify:", "");

    // Update user emailVerified field and delete the token
    await prisma.$transaction([
      prisma.user.update({
        where: { email },
        data: { emailVerified: new Date() },
      }),
      prisma.verificationToken.delete({
        where: {
          identifier_token: {
            identifier: verificationToken.identifier,
            token: verificationToken.token,
          },
        },
      }),
    ]);

    return NextResponse.json({
      message: "Email verified successfully",
      verified: true,
    });
  } catch (error) {
    console.error("Email verification error:", error);
    return NextResponse.json(
      { error: "Something went wrong", verified: false },
      { status: 500 }
    );
  }
}

// POST - Resend verification email
export async function POST(request: Request) {
  try {
    const session = await auth();

    // Check if user is authenticated
    if (!session?.user?.email) {
      // Try to get email from request body for unauthenticated resend
      const body = await request.json().catch(() => ({}));
      const email = body.email;

      if (!email) {
        return NextResponse.json(
          { error: "Authentication required or email must be provided" },
          { status: 401 }
        );
      }

      // Find user by email
      const user = await prisma.user.findUnique({
        where: { email },
        select: { id: true, name: true, email: true, emailVerified: true },
      });

      if (!user) {
        // Don't reveal if user exists
        return NextResponse.json({
          message: "If your email is registered, you will receive a verification link.",
        });
      }

      if (user.emailVerified) {
        return NextResponse.json(
          { error: "Email is already verified" },
          { status: 400 }
        );
      }

      // Generate and send verification email
      await generateAndSendVerificationEmail(user.email, user.name || "there");

      return NextResponse.json({
        message: "If your email is registered, you will receive a verification link.",
      });
    }

    // For authenticated users
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, name: true, email: true, emailVerified: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    if (user.emailVerified) {
      return NextResponse.json(
        { error: "Email is already verified" },
        { status: 400 }
      );
    }

    // Generate and send verification email
    await generateAndSendVerificationEmail(user.email, user.name || "there");

    return NextResponse.json({
      message: "Verification email sent",
    });
  } catch (error) {
    console.error("Resend verification error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}

// Helper function to generate and send verification email
export async function generateAndSendVerificationEmail(email: string, name: string): Promise<void> {
  // Generate secure token
  const token = crypto.randomBytes(32).toString("hex");
  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

  // Delete any existing verification tokens for this user
  await prisma.verificationToken.deleteMany({
    where: {
      identifier: `email-verify:${email}`,
    },
  });

  // Create new token (expires in 24 hours)
  await prisma.verificationToken.create({
    data: {
      identifier: `email-verify:${email}`,
      token: hashedToken,
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    },
  });

  // Send verification email
  await sendVerificationEmail(email, name, token);
}
