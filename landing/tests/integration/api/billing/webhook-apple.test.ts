// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { prismaMock, resetPrismaMock } from "@/tests/helpers/prisma-mock";

// Mock only the verifier — upsertAppleTransaction / recomputeUserPlan stay real
const mockVerifyNotification = vi.fn();
const mockVerifyTransaction = vi.fn();

vi.mock("@/lib/apple-iap", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/apple-iap")>();
  return {
    ...actual,
    getAppleVerifier: () => ({
      verifyAndDecodeNotification: mockVerifyNotification,
      verifyAndDecodeTransaction: mockVerifyTransaction,
    }),
  };
});

import { POST } from "@/app/api/webhooks/apple/route";

const APP_ACCOUNT_TOKEN = "9f1c2e34-0000-4000-8000-000000000001";
const DAY_MS = 24 * 60 * 60 * 1000;

function makeRequest(body: unknown = { signedPayload: "ey.signed.payload" }): Request {
  return new Request("http://localhost:3000/api/webhooks/apple", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function decodedTransaction(overrides: Record<string, unknown> = {}) {
  return {
    originalTransactionId: "apple-orig-1",
    transactionId: "apple-tx-1",
    productId: "com.queenmama.ios.pro.monthly",
    bundleId: "com.queenmama.ios",
    expiresDate: Date.now() + 30 * DAY_MS,
    environment: "Production",
    ...overrides,
  };
}

function notification(
  notificationType: string,
  subtype?: string,
  dataOverrides: Record<string, unknown> = {}
) {
  return {
    notificationType,
    subtype,
    data: {
      bundleId: "com.queenmama.ios",
      environment: "Production",
      signedTransactionInfo: "ey.signed.transaction",
      ...dataOverrides,
    },
  };
}

/** Sets up an orphan transaction (no user resolution) for mapping tests */
function setupOrphan(decoded = decodedTransaction()) {
  mockVerifyTransaction.mockResolvedValue(decoded);
  prismaMock.appleTransaction.findUnique.mockResolvedValue(null);
  prismaMock.user.findUnique.mockResolvedValue(null);
  prismaMock.appleTransaction.upsert.mockResolvedValue({} as never);
}

function expectUpsertStatus(data: Record<string, unknown>) {
  expect(prismaMock.appleTransaction.upsert).toHaveBeenCalledWith(
    expect.objectContaining({
      where: { originalTransactionId: "apple-orig-1" },
      update: expect.objectContaining(data),
    })
  );
}

describe("POST /api/webhooks/apple", () => {
  beforeEach(() => {
    resetPrismaMock();
    mockVerifyNotification.mockReset();
    mockVerifyTransaction.mockReset();
  });

  // =========================================
  // Authentication (= signature verification)
  // =========================================
  it("returns 400 when signedPayload is missing", async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it("returns 401 on bad signature", async () => {
    mockVerifyNotification.mockRejectedValue(new Error("verification failed"));

    const res = await POST(makeRequest());
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error).toBe("invalid_signature");
  });

  it("returns 200 for TEST notifications without touching the DB", async () => {
    mockVerifyNotification.mockResolvedValue({ notificationType: "TEST" });

    const res = await POST(makeRequest());

    expect(res.status).toBe(200);
    expect(prismaMock.appleTransaction.upsert).not.toHaveBeenCalled();
  });

  // =========================================
  // Notification type mapping
  // =========================================
  it.each([
    ["SUBSCRIBED", undefined, "active"],
    ["DID_RENEW", undefined, "active"],
    ["DID_FAIL_TO_RENEW", "GRACE_PERIOD", "grace"],
    ["DID_FAIL_TO_RENEW", undefined, "billing_retry"],
    ["EXPIRED", "VOLUNTARY", "expired"],
    ["GRACE_PERIOD_EXPIRED", undefined, "expired"],
    ["REFUND", undefined, "revoked"],
    ["REVOKE", undefined, "revoked"],
  ])("%s (%s) -> status %s", async (type, subtype, expectedStatus) => {
    mockVerifyNotification.mockResolvedValue(notification(type, subtype));
    setupOrphan();

    const res = await POST(makeRequest());

    expect(res.status).toBe(200);
    expectUpsertStatus({ status: expectedStatus });
  });

  it("DID_CHANGE_RENEWAL_STATUS AUTO_RENEW_DISABLED -> autoRenew false", async () => {
    mockVerifyNotification.mockResolvedValue(
      notification("DID_CHANGE_RENEWAL_STATUS", "AUTO_RENEW_DISABLED")
    );
    setupOrphan();

    const res = await POST(makeRequest());

    expect(res.status).toBe(200);
    expectUpsertStatus({ autoRenew: false });
  });

  it("DID_CHANGE_RENEWAL_STATUS AUTO_RENEW_ENABLED -> autoRenew true", async () => {
    mockVerifyNotification.mockResolvedValue(
      notification("DID_CHANGE_RENEWAL_STATUS", "AUTO_RENEW_ENABLED")
    );
    setupOrphan();

    await POST(makeRequest());

    expectUpsertStatus({ autoRenew: true });
  });

  it("DID_CHANGE_RENEWAL_PREF -> refreshes productId from the transaction", async () => {
    mockVerifyNotification.mockResolvedValue(
      notification("DID_CHANGE_RENEWAL_PREF", "UPGRADE")
    );
    setupOrphan(
      decodedTransaction({ productId: "com.queenmama.ios.pro.yearly" })
    );

    const res = await POST(makeRequest());

    expect(res.status).toBe(200);
    expectUpsertStatus({
      productId: "com.queenmama.ios.pro.yearly",
      status: "active",
    });
  });

  it("returns 200 and skips unhandled notification types", async () => {
    mockVerifyNotification.mockResolvedValue(notification("PRICE_INCREASE"));
    mockVerifyTransaction.mockResolvedValue(decodedTransaction());

    const res = await POST(makeRequest());

    expect(res.status).toBe(200);
    expect(prismaMock.appleTransaction.upsert).not.toHaveBeenCalled();
  });

  // =========================================
  // User resolution
  // =========================================
  it("resolves the user via appAccountToken and recomputes the plan", async () => {
    mockVerifyNotification.mockResolvedValue(notification("SUBSCRIBED", "INITIAL_BUY"));
    const decoded = decodedTransaction({ appAccountToken: APP_ACCOUNT_TOKEN });
    mockVerifyTransaction.mockResolvedValue(decoded);

    // resolveUserId: no existing tx, user found by appAccountToken
    prismaMock.appleTransaction.findUnique.mockResolvedValue(null);
    prismaMock.user.findUnique.mockResolvedValue({ id: "user-1" } as never);
    prismaMock.appleTransaction.upsert.mockResolvedValue({} as never);

    // recomputeUserPlan
    prismaMock.subscription.findUnique.mockResolvedValue(null);
    prismaMock.appleTransaction.findMany.mockResolvedValue([
      {
        originalTransactionId: "apple-orig-1",
        userId: "user-1",
        productId: "com.queenmama.ios.pro.monthly",
        status: "active",
        expiresAt: new Date(Date.now() + 30 * DAY_MS),
        autoRenew: true,
        environment: "Production",
        createdAt: new Date(),
        updatedAt: new Date(),
      } as never,
    ]);
    prismaMock.subscription.upsert.mockResolvedValue({} as never);
    prismaMock.usageLog.create.mockResolvedValue({} as never);

    const res = await POST(makeRequest());

    expect(res.status).toBe(200);
    expect(prismaMock.appleTransaction.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ userId: "user-1", status: "active" }),
      })
    );
    expect(prismaMock.subscription.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-1" },
        update: expect.objectContaining({ plan: "PRO", provider: "APPLE" }),
      })
    );
    expect(prismaMock.usageLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "APPLE_PLAN_CHANGED",
          metadata: expect.objectContaining({ oldPlan: "FREE", newPlan: "PRO" }),
        }),
      })
    );
  });

  it("resolves the user via an existing transaction binding", async () => {
    mockVerifyNotification.mockResolvedValue(notification("DID_RENEW"));
    mockVerifyTransaction.mockResolvedValue(decodedTransaction());

    prismaMock.appleTransaction.findUnique.mockResolvedValue({
      userId: "user-1",
    } as never);
    prismaMock.appleTransaction.upsert.mockResolvedValue({} as never);
    prismaMock.subscription.findUnique.mockResolvedValue({
      id: "sub-db-id",
      userId: "user-1",
      plan: "PRO",
      status: "ACTIVE",
      provider: "APPLE",
      stripeSubscriptionId: null,
      currentPeriodEnd: new Date(),
      cancelAtPeriodEnd: false,
    } as never);
    prismaMock.appleTransaction.findMany.mockResolvedValue([
      {
        originalTransactionId: "apple-orig-1",
        userId: "user-1",
        productId: "com.queenmama.ios.pro.monthly",
        status: "active",
        expiresAt: new Date(Date.now() + 30 * DAY_MS),
        autoRenew: true,
        environment: "Production",
        createdAt: new Date(),
        updatedAt: new Date(),
      } as never,
    ]);
    prismaMock.subscription.upsert.mockResolvedValue({} as never);

    const res = await POST(makeRequest());

    expect(res.status).toBe(200);
    // Plan unchanged (PRO -> PRO): no audit log
    expect(prismaMock.usageLog.create).not.toHaveBeenCalled();
  });

  it("stores an orphan row when no user can be resolved", async () => {
    mockVerifyNotification.mockResolvedValue(notification("SUBSCRIBED"));
    setupOrphan(decodedTransaction({ appAccountToken: APP_ACCOUNT_TOKEN }));

    const res = await POST(makeRequest());

    expect(res.status).toBe(200);
    expect(prismaMock.appleTransaction.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ userId: null }),
      })
    );
    // No user -> no plan recompute
    expect(prismaMock.subscription.upsert).not.toHaveBeenCalled();
  });

  it("ignores notifications without transaction info", async () => {
    mockVerifyNotification.mockResolvedValue({
      notificationType: "SUBSCRIBED",
      data: { bundleId: "com.queenmama.ios" },
    });

    const res = await POST(makeRequest());

    expect(res.status).toBe(200);
    expect(mockVerifyTransaction).not.toHaveBeenCalled();
  });
});
