import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { verifyAccessToken } from "@/lib/device-auth";

/**
 * POST /api/auth/magic-link/generate
 * Generates a magic link token for auto-login on the web
 * Called from macOS app when user wants to upgrade/access web features
 */
export async function POST(request: Request) {
  try {
    // Verify JWT from macOS app
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "unauthorized", message: "Missing authorization token" },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    let payload;
    try {
      payload = await verifyAccessToken(token);
    } catch {
      return NextResponse.json(
        { error: "invalid_token", message: "Invalid or expired token" },
        { status: 401 }
      );
    }

    const userId = payload.sub;
    const email = payload.email;

    // Get the redirect destination from body (optional)
    const body = await request.json().catch(() => ({}));
    const redirect = body.redirect || "/dashboard";

    // Generate a secure random token
    const magicToken = crypto.randomBytes(32).toString("base64url");
    console.log("[MagicLink] Generated token for:", email);

    // Store in VerificationToken with 5 minute expiry
    const expires = new Date(Date.now() + 5 * 60 * 1000);

    // Delete any existing magic link tokens for this user
    await prisma.verificationToken.deleteMany({
      where: {
        identifier: `magic:${email}`,
      },
    });

    // Create new token
    const created = await prisma.verificationToken.create({
      data: {
        identifier: `magic:${email}`,
        token: magicToken,
        expires,
      },
    });
    console.log("[MagicLink] Token saved with identifier:", created.identifier, "expires:", created.expires);

    // Build the magic link URL
    const baseUrl = process.env.NEXTAUTH_URL || "https://www.queenmama.co";
    const magicLinkUrl = `${baseUrl}/auth/magic-link?token=${magicToken}&redirect=${encodeURIComponent(redirect)}`;
    console.log("[MagicLink] Generated URL:", magicLinkUrl);

    return NextResponse.json({
      url: magicLinkUrl,
      expiresIn: 300, // 5 minutes
    });
  } catch (error) {
    console.error("Magic link generation error:", error);
    return NextResponse.json(
      { error: "server_error", message: "Failed to generate magic link" },
      { status: 500 }
    );
  }
}
