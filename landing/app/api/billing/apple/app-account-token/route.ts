import crypto from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAccessToken } from "@/lib/device-auth";

/**
 * GET /api/billing/apple/app-account-token
 * Returns the user's appAccountToken (a stable UUID the iOS app attaches to
 * StoreKit purchases so App Store Server Notifications can be mapped back to
 * the user). Generated lazily on first request.
 */
export async function GET(request: Request) {
  try {
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

    const user = await prisma.user.findUnique({
      where: { id: tokenPayload.sub },
      select: { id: true, appAccountToken: true },
    });

    if (!user) {
      return NextResponse.json({ error: "user_not_found" }, { status: 404 });
    }

    let appAccountToken = user.appAccountToken;
    if (!appAccountToken) {
      appAccountToken = crypto.randomUUID();
      await prisma.user.update({
        where: { id: user.id },
        data: { appAccountToken },
      });
    }

    return NextResponse.json({ appAccountToken });
  } catch (error) {
    console.error("[AppleIAP] app-account-token error:", error);
    return NextResponse.json(
      { error: "server_error", message: "Failed to get app account token" },
      { status: 500 }
    );
  }
}
