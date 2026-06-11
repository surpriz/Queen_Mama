import { NextResponse } from "next/server";
import {
  NotificationTypeV2,
  Subtype,
  type JWSTransactionDecodedPayload,
} from "@apple/app-store-server-library";
import { prisma } from "@/lib/prisma";
import {
  getAppleVerifier,
  upsertAppleTransaction,
  recomputeUserPlan,
  deriveTransactionStatus,
  type AppleEntitlementStatus,
} from "@/lib/apple-iap";

/**
 * Resolves the user owning a transaction: prefer the existing AppleTransaction
 * binding, fall back to the appAccountToken set on the purchase.
 */
async function resolveUserId(
  decoded: JWSTransactionDecodedPayload
): Promise<string | null> {
  if (decoded.originalTransactionId) {
    const existing = await prisma.appleTransaction.findUnique({
      where: { originalTransactionId: decoded.originalTransactionId },
      select: { userId: true },
    });
    if (existing?.userId) return existing.userId;
  }

  if (decoded.appAccountToken) {
    const user = await prisma.user.findUnique({
      where: { appAccountToken: decoded.appAccountToken },
      select: { id: true },
    });
    if (user) return user.id;
  }

  return null;
}

/**
 * POST /api/webhooks/apple
 * App Store Server Notifications V2. The signedPayload verification IS the
 * authentication — 401 on bad signature, 200 once handled.
 */
export async function POST(request: Request) {
  let signedPayload: string | undefined;
  try {
    const body = await request.json();
    signedPayload = body?.signedPayload;
  } catch {
    // fall through to the check below
  }

  if (!signedPayload) {
    return NextResponse.json(
      { error: "invalid_request", message: "Missing signedPayload" },
      { status: 400 }
    );
  }

  let notification;
  try {
    notification = await getAppleVerifier().verifyAndDecodeNotification(
      signedPayload
    );
  } catch (error) {
    console.error("[AppleWebhook] Signature verification failed:", error);
    return NextResponse.json(
      { error: "invalid_signature", message: "Payload verification failed" },
      { status: 401 }
    );
  }

  try {
    const { notificationType, subtype, data } = notification;

    if (notificationType === NotificationTypeV2.TEST) {
      return NextResponse.json({ received: true });
    }

    if (!data?.signedTransactionInfo) {
      // Nothing to reconcile (e.g. summary/external purchase notifications)
      console.log(`[AppleWebhook] Ignoring ${notificationType} (no transaction info)`);
      return NextResponse.json({ received: true });
    }

    const decoded = await getAppleVerifier().verifyAndDecodeTransaction(
      data.signedTransactionInfo
    );

    // Map notification type -> entitlement status / autoRenew change
    let status: AppleEntitlementStatus | undefined;
    let autoRenew: boolean | undefined;
    let handled = true;

    switch (notificationType) {
      case NotificationTypeV2.SUBSCRIBED:
      case NotificationTypeV2.DID_RENEW:
        status = "active";
        break;

      case NotificationTypeV2.DID_CHANGE_RENEWAL_STATUS:
        autoRenew = subtype === Subtype.AUTO_RENEW_ENABLED;
        break;

      case NotificationTypeV2.DID_FAIL_TO_RENEW:
        // GRACE_PERIOD subtype: Apple keeps entitlement during grace
        status = subtype === Subtype.GRACE_PERIOD ? "grace" : "billing_retry";
        break;

      case NotificationTypeV2.EXPIRED:
      case NotificationTypeV2.GRACE_PERIOD_EXPIRED:
        status = "expired";
        break;

      case NotificationTypeV2.REFUND:
      case NotificationTypeV2.REVOKE:
        // Access is revoked immediately
        status = "revoked";
        break;

      case NotificationTypeV2.DID_CHANGE_RENEWAL_PREF:
        // Product change (upgrade applies immediately, downgrade at renewal) —
        // the upsert below refreshes productId/expiresAt from the transaction
        status = deriveTransactionStatus(decoded);
        break;

      default:
        handled = false;
        break;
    }

    if (!handled) {
      console.log(`[AppleWebhook] Unhandled notification type: ${notificationType}`);
      return NextResponse.json({ received: true });
    }

    const userId = await resolveUserId(decoded);

    // Unknown user -> store an orphan row, claimable later via the
    // /api/billing/apple/transaction endpoint
    await upsertAppleTransaction(decoded, {
      ...(userId ? { userId } : {}),
      ...(status !== undefined ? { status } : {}),
      ...(autoRenew !== undefined ? { autoRenew } : {}),
    });

    if (userId) {
      const { plan, previousPlan } = await recomputeUserPlan(userId);

      // Mirror the Stripe webhook's audit pattern
      if (plan !== previousPlan) {
        await prisma.usageLog.create({
          data: {
            userId,
            action: "APPLE_PLAN_CHANGED",
            metadata: {
              targetUserId: userId,
              oldPlan: previousPlan,
              newPlan: plan,
              notificationType: notificationType ?? null,
              subtype: subtype ?? null,
              originalTransactionId: decoded.originalTransactionId ?? null,
            },
          },
        });
      }
    } else {
      console.warn(
        `[AppleWebhook] No user for transaction ${decoded.originalTransactionId} — stored as orphan`
      );
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[AppleWebhook] Handler error:", error);
    return NextResponse.json(
      { error: "webhook_handler_failed" },
      { status: 500 }
    );
  }
}
