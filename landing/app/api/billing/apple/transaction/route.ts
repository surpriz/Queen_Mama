import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAccessToken } from "@/lib/device-auth";
import { appleTransactionSchema } from "@/lib/validations";
import {
  getAppleVerifier,
  upsertAppleTransaction,
  recomputeUserPlan,
} from "@/lib/apple-iap";

/**
 * POST /api/billing/apple/transaction
 * Called by the iOS app after a StoreKit 2 purchase with the signed
 * transaction JWS. Verifies the JWS, binds the transaction to the
 * authenticated user and recomputes the effective plan.
 */
export async function POST(request: Request) {
  try {
    // Same device Bearer token mechanism as /api/license/validate
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
    const parsed = appleTransactionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "invalid_request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Verify the JWS signature + bundleId/environment (done by the verifier)
    let decoded;
    try {
      decoded = await getAppleVerifier().verifyAndDecodeTransaction(
        parsed.data.signedTransaction
      );
    } catch (error) {
      console.error("[AppleIAP] Transaction verification failed:", error);
      return NextResponse.json(
        { error: "invalid_transaction", message: "Transaction verification failed" },
        { status: 400 }
      );
    }

    if (!decoded.originalTransactionId) {
      return NextResponse.json(
        { error: "invalid_transaction", message: "Missing originalTransactionId" },
        { status: 400 }
      );
    }

    const userId = tokenPayload.sub;

    // Reject if the transaction is already bound to a different account
    const existing = await prisma.appleTransaction.findUnique({
      where: { originalTransactionId: decoded.originalTransactionId },
    });
    if (existing?.userId && existing.userId !== userId) {
      return NextResponse.json(
        {
          error: "transaction_conflict",
          message: "This purchase is already linked to another account",
        },
        { status: 409 }
      );
    }

    await upsertAppleTransaction(decoded, { userId });

    // Backfill the user's appAccountToken from the transaction if not set yet,
    // so App Store Server Notifications can be resolved to this user.
    if (decoded.appAccountToken) {
      try {
        await prisma.user.updateMany({
          where: { id: userId, appAccountToken: null },
          data: { appAccountToken: decoded.appAccountToken },
        });
      } catch (error) {
        // Unique conflict (token claimed elsewhere) — not fatal
        console.warn("[AppleIAP] Could not backfill appAccountToken:", error);
      }
    }

    const { plan } = await recomputeUserPlan(userId);

    return NextResponse.json({ ok: true, plan });
  } catch (error) {
    console.error("[AppleIAP] Transaction endpoint error:", error);
    return NextResponse.json(
      { error: "server_error", message: "Failed to process transaction" },
      { status: 500 }
    );
  }
}
