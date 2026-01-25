import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { encode } from "next-auth/jwt";

/**
 * POST /api/auth/magic-link/verify
 * Verifies a magic link token and creates a session
 */
export async function POST(request: Request) {
  try {
    const { token } = await request.json();
    console.log("[MagicLink] Verifying token:", token?.substring(0, 10) + "...");

    if (!token) {
      console.log("[MagicLink] Error: Missing token");
      return NextResponse.json(
        { success: false, message: "Missing token" },
        { status: 400 }
      );
    }

    // Find the token in the database
    const verificationToken = await prisma.verificationToken.findFirst({
      where: {
        token,
        identifier: { startsWith: "magic:" },
        expires: { gt: new Date() },
      },
    });

    console.log("[MagicLink] Token found:", !!verificationToken);

    if (!verificationToken) {
      // Debug: check if token exists but expired
      const anyToken = await prisma.verificationToken.findFirst({
        where: { token },
      });
      console.log("[MagicLink] Token exists but wrong prefix/expired:", anyToken?.identifier, anyToken?.expires);
      return NextResponse.json(
        { success: false, message: "Invalid or expired link" },
        { status: 400 }
      );
    }

    // Extract email from identifier
    const email = verificationToken.identifier.replace("magic:", "");

    // Find the user
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        role: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, message: "User not found" },
        { status: 400 }
      );
    }

    // Check if user is blocked
    if (user.role === "BLOCKED") {
      return NextResponse.json(
        { success: false, message: "Account has been blocked" },
        { status: 403 }
      );
    }

    // Delete the used token
    await prisma.verificationToken.delete({
      where: {
        identifier_token: {
          identifier: verificationToken.identifier,
          token: verificationToken.token,
        },
      },
    });

    // Create a NextAuth JWT token
    const secret = process.env.AUTH_SECRET;
    if (!secret) {
      throw new Error("AUTH_SECRET not configured");
    }

    const isProduction = process.env.NODE_ENV === "production";
    const cookieName = isProduction
      ? "__Secure-authjs.session-token"
      : "authjs.session-token";

    const jwtToken = await encode({
      token: {
        id: user.id,
        name: user.name,
        email: user.email,
        picture: user.image,
        role: user.role,
        sub: user.id,
      },
      secret,
      salt: cookieName, // Required by NextAuth v5
      maxAge: 30 * 24 * 60 * 60, // 30 days
    });

    // Set the session cookie
    const cookieStore = await cookies();

    cookieStore.set(cookieName, jwtToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 24 * 60 * 60, // 30 days
    });

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Magic link verification error:", error);
    return NextResponse.json(
      { success: false, message: "Verification failed" },
      { status: 500 }
    );
  }
}
