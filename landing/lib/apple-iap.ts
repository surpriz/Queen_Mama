import fs from "fs";
import path from "path";
import {
  Environment,
  SignedDataVerifier,
  type JWSTransactionDecodedPayload,
} from "@apple/app-store-server-library";
import { prisma } from "@/lib/prisma";
import type {
  AppleTransaction,
  Subscription,
  SubscriptionPlan,
  SubscriptionStatus,
} from "@prisma/client";

// ===========================================
// CONFIGURATION
// ===========================================

export const APPLE_BUNDLE_ID =
  process.env.APPLE_BUNDLE_ID || "com.queenmama.ios";

/**
 * Maps App Store product identifiers to subscription plans.
 * Pro and Enterprise are both self-serve auto-renewable tiers (monthly/yearly).
 */
export const PRODUCT_PLAN_MAP: Record<string, SubscriptionPlan> = {
  "com.queenmama.ios.pro.monthly": "PRO",
  "com.queenmama.ios.pro.yearly": "PRO",
  "com.queenmama.ios.enterprise.monthly": "ENTERPRISE",
  "com.queenmama.ios.enterprise.yearly": "ENTERPRISE",
};

const PLAN_RANK: Record<SubscriptionPlan, number> = {
  FREE: 0,
  PRO: 1,
  ENTERPRISE: 2,
};

/** Internal entitlement states stored in AppleTransaction.status */
export type AppleEntitlementStatus =
  | "active"
  | "grace"
  | "billing_retry"
  | "expired"
  | "revoked";

// Small leeway so an entitlement is not cut off mid-request while Apple's
// DID_RENEW notification is in flight.
const EXPIRY_LEEWAY_MS = 5 * 60 * 1000; // 5 minutes

// Apple's billing grace period lasts at most 28 days after expiry. A row stuck
// in "grace" (e.g. missed GRACE_PERIOD_EXPIRED webhook) hard-expires after that.
const MAX_GRACE_PERIOD_MS = 28 * 24 * 60 * 60 * 1000;

// ===========================================
// SIGNED DATA VERIFIER (lazy singleton)
// ===========================================

let verifier: SignedDataVerifier | null = null;

/**
 * Loads the Apple root CA certificates (DER .cer files) required by
 * SignedDataVerifier. Bundled under lib/apple-certs/, overridable with
 * APPLE_ROOT_CA_DIR.
 */
function loadAppleRootCertificates(): Buffer[] {
  const dir =
    process.env.APPLE_ROOT_CA_DIR ||
    path.join(process.cwd(), "lib", "apple-certs");

  let files: string[] = [];
  try {
    files = fs.readdirSync(dir).filter((f) => f.endsWith(".cer"));
  } catch {
    // fall through to the error below
  }

  if (files.length === 0) {
    throw new Error(
      `No Apple root CA certificates (.cer) found in "${dir}". ` +
        `Download them from https://www.apple.com/certificateauthority/ ` +
        `or set APPLE_ROOT_CA_DIR to a directory containing them.`
    );
  }

  return files.map((f) => fs.readFileSync(path.join(dir, f)));
}

/**
 * Lazy singleton SignedDataVerifier configured from env:
 * - APPLE_BUNDLE_ID (default com.queenmama.ios)
 * - APPLE_APP_APPLE_ID (required in Production)
 * - APPLE_IAP_ENVIRONMENT ("Sandbox" | "Production", default Sandbox)
 */
export function getAppleVerifier(): SignedDataVerifier {
  if (!verifier) {
    const environment =
      process.env.APPLE_IAP_ENVIRONMENT === "Production"
        ? Environment.PRODUCTION
        : Environment.SANDBOX;

    const appAppleId = process.env.APPLE_APP_APPLE_ID
      ? Number(process.env.APPLE_APP_APPLE_ID)
      : undefined;

    if (environment === Environment.PRODUCTION && !appAppleId) {
      throw new Error(
        "APPLE_APP_APPLE_ID is required when APPLE_IAP_ENVIRONMENT=Production"
      );
    }

    verifier = new SignedDataVerifier(
      loadAppleRootCertificates(),
      true, // enable online revocation checks
      environment,
      APPLE_BUNDLE_ID,
      appAppleId
    );
  }
  return verifier;
}

/** Test helper — resets the lazy singleton. */
export function resetAppleVerifier(): void {
  verifier = null;
}

// ===========================================
// TRANSACTION PERSISTENCE
// ===========================================

/**
 * Derives the entitlement status from a decoded transaction when no
 * notification-specific status applies.
 */
export function deriveTransactionStatus(
  decoded: JWSTransactionDecodedPayload
): AppleEntitlementStatus {
  if (decoded.revocationDate) return "revoked";
  if (decoded.expiresDate && decoded.expiresDate > Date.now()) return "active";
  return "expired";
}

/**
 * Upserts the AppleTransaction row for a verified decoded transaction.
 * userId is only written when explicitly provided (pass null to orphan).
 */
export async function upsertAppleTransaction(
  decoded: JWSTransactionDecodedPayload,
  options: {
    userId?: string | null;
    status?: AppleEntitlementStatus;
    autoRenew?: boolean;
  } = {}
): Promise<AppleTransaction> {
  const originalTransactionId = decoded.originalTransactionId;
  if (!originalTransactionId) {
    throw new Error("Decoded Apple transaction is missing originalTransactionId");
  }

  const status = options.status ?? deriveTransactionStatus(decoded);
  const shared = {
    productId: decoded.productId ?? "",
    status,
    expiresAt: decoded.expiresDate ? new Date(decoded.expiresDate) : null,
    environment: decoded.environment?.toString() ?? "Sandbox",
  };

  return prisma.appleTransaction.upsert({
    where: { originalTransactionId },
    create: {
      originalTransactionId,
      ...shared,
      userId: options.userId ?? null,
      autoRenew: options.autoRenew ?? true,
    },
    update: {
      ...shared,
      ...(options.userId !== undefined ? { userId: options.userId } : {}),
      ...(options.autoRenew !== undefined
        ? { autoRenew: options.autoRenew }
        : {}),
    },
  });
}

// ===========================================
// ENTITLEMENT EVALUATION
// ===========================================

/**
 * Whether an AppleTransaction row still grants entitlement.
 * - active: expiresAt in the future (small leeway)
 * - grace: Apple keeps access during billing grace; bounded by the 28-day max
 * - billing_retry / expired / revoked: no entitlement
 */
export function isAppleEntitlementActive(tx: {
  status: string;
  expiresAt: Date | null;
}): boolean {
  const now = Date.now();

  if (tx.status === "grace") {
    if (!tx.expiresAt) return true;
    return tx.expiresAt.getTime() + MAX_GRACE_PERIOD_MS > now;
  }

  if (tx.status !== "active") return false;
  if (!tx.expiresAt) return false;
  return tx.expiresAt.getTime() + EXPIRY_LEEWAY_MS > now;
}

// ===========================================
// PLAN RECONCILIATION
// ===========================================

const STRIPE_ENTITLED_STATUSES: SubscriptionStatus[] = [
  "ACTIVE",
  "TRIALING",
  "PAST_DUE",
];

interface StripeStateOverride {
  active: boolean;
  plan?: SubscriptionPlan;
  status?: SubscriptionStatus;
  periodEnd?: Date | null;
}

/**
 * Infers the Stripe entitlement from the stored Subscription row.
 * The row only reflects Stripe state when provider is STRIPE — when an Apple
 * purchase won the last reconciliation, plan/status belong to Apple and Stripe
 * is treated as inactive (the Stripe webhook passes a fresh override instead).
 */
function inferStripeState(sub: Subscription | null): StripeStateOverride {
  if (!sub?.stripeSubscriptionId || sub.provider === "APPLE") {
    return { active: false };
  }
  const active =
    sub.plan !== "FREE" && STRIPE_ENTITLED_STATUSES.includes(sub.status);
  return {
    active,
    plan: sub.plan,
    status: sub.status,
    periodEnd: sub.currentPeriodEnd,
  };
}

export interface RecomputeResult {
  plan: SubscriptionPlan;
  previousPlan: SubscriptionPlan;
}

/**
 * Recomputes the user's effective plan from all billing sources (Stripe +
 * Apple) and upserts the single Subscription row with the winning
 * plan/status/provider/periodEnd. Safe to call from both webhooks.
 *
 * Pass `stripeOverride` when the caller (the Stripe webhook) knows fresher
 * Stripe state than the stored row.
 */
export async function recomputeUserPlan(
  userId: string,
  options: { stripeOverride?: StripeStateOverride } = {}
): Promise<RecomputeResult> {
  const [sub, appleTransactions] = await Promise.all([
    prisma.subscription.findUnique({ where: { userId } }),
    prisma.appleTransaction.findMany({ where: { userId } }),
  ]);

  const previousPlan: SubscriptionPlan = sub?.plan ?? "FREE";

  // --- Stripe candidate ---
  const stripe = options.stripeOverride ?? inferStripeState(sub);

  // --- Apple candidate: highest plan among still-active transactions ---
  const activeApple = appleTransactions.filter(
    (tx) => isAppleEntitlementActive(tx) && PRODUCT_PLAN_MAP[tx.productId]
  );
  let applePlan: SubscriptionPlan | null = null;
  let appleBest: AppleTransaction | null = null;
  for (const tx of activeApple) {
    const plan = PRODUCT_PLAN_MAP[tx.productId];
    if (
      !applePlan ||
      PLAN_RANK[plan] > PLAN_RANK[applePlan] ||
      (PLAN_RANK[plan] === PLAN_RANK[applePlan] &&
        (tx.expiresAt?.getTime() ?? 0) > (appleBest?.expiresAt?.getTime() ?? 0))
    ) {
      applePlan = plan;
      appleBest = tx;
    }
  }

  // --- Pick the winner (highest tier; Stripe wins ties) ---
  type Winner = {
    plan: SubscriptionPlan;
    status: SubscriptionStatus;
    provider: "STRIPE" | "APPLE";
    periodEnd: Date | null;
    cancelAtPeriodEnd: boolean;
  };

  let winner: Winner | null = null;

  if (stripe.active && stripe.plan && stripe.plan !== "FREE") {
    winner = {
      plan: stripe.plan,
      status: stripe.status ?? "ACTIVE",
      provider: "STRIPE",
      periodEnd: stripe.periodEnd ?? null,
      cancelAtPeriodEnd: sub?.cancelAtPeriodEnd ?? false,
    };
  }

  if (applePlan && appleBest && (!winner || PLAN_RANK[applePlan] > PLAN_RANK[winner.plan])) {
    winner = {
      plan: applePlan,
      status: appleBest.status === "grace" ? "PAST_DUE" : "ACTIVE",
      provider: "APPLE",
      periodEnd: appleBest.expiresAt,
      cancelAtPeriodEnd: !appleBest.autoRenew,
    };
  }

  if (!winner) {
    // Nothing active — downgrade to FREE (only persist if there is anything to persist)
    if (!sub && appleTransactions.length === 0) {
      return { plan: "FREE", previousPlan };
    }
    await prisma.subscription.upsert({
      where: { userId },
      create: { userId, plan: "FREE", status: "CANCELED" },
      update: { plan: "FREE", status: "CANCELED" },
    });
    return { plan: "FREE", previousPlan };
  }

  await prisma.subscription.upsert({
    where: { userId },
    create: {
      userId,
      plan: winner.plan,
      status: winner.status,
      provider: winner.provider,
      currentPeriodEnd: winner.periodEnd,
      cancelAtPeriodEnd: winner.cancelAtPeriodEnd,
    },
    update: {
      plan: winner.plan,
      status: winner.status,
      provider: winner.provider,
      currentPeriodEnd: winner.periodEnd,
      cancelAtPeriodEnd: winner.cancelAtPeriodEnd,
    },
  });

  return { plan: winner.plan, previousPlan };
}
