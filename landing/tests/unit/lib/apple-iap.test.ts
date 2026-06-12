// @vitest-environment node
import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock, resetPrismaMock } from "@/tests/helpers/prisma-mock";
import {
  PRODUCT_PLAN_MAP,
  deriveTransactionStatus,
  isAppleEntitlementActive,
  recomputeUserPlan,
} from "@/lib/apple-iap";

const USER_ID = "test-user-id-123";
const DAY_MS = 24 * 60 * 60 * 1000;

function appleTx(overrides: Record<string, unknown> = {}) {
  return {
    originalTransactionId: "apple-orig-1",
    userId: USER_ID,
    productId: "com.queenmama.ios.pro.monthly",
    status: "active",
    expiresAt: new Date(Date.now() + 7 * DAY_MS),
    autoRenew: true,
    environment: "Production",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function stripeSub(overrides: Record<string, unknown> = {}) {
  return {
    id: "sub-db-id",
    userId: USER_ID,
    plan: "PRO",
    status: "ACTIVE",
    provider: "STRIPE",
    stripeSubscriptionId: "sub_stripe_1",
    stripePriceId: "price_pro",
    currentPeriodStart: new Date(),
    currentPeriodEnd: new Date(Date.now() + 30 * DAY_MS),
    cancelAtPeriodEnd: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function mockState(
  sub: ReturnType<typeof stripeSub> | null,
  appleTxs: ReturnType<typeof appleTx>[]
) {
  prismaMock.subscription.findUnique.mockResolvedValue(sub as never);
  prismaMock.appleTransaction.findMany.mockResolvedValue(appleTxs as never);
  prismaMock.subscription.upsert.mockResolvedValue({} as never);
}

function upsertedWith(data: Record<string, unknown>) {
  expect(prismaMock.subscription.upsert).toHaveBeenCalledWith(
    expect.objectContaining({
      where: { userId: USER_ID },
      update: expect.objectContaining(data),
    })
  );
}

describe("PRODUCT_PLAN_MAP", () => {
  it("maps both iOS products to PRO", () => {
    expect(PRODUCT_PLAN_MAP["com.queenmama.ios.pro.monthly"]).toBe("PRO");
    expect(PRODUCT_PLAN_MAP["com.queenmama.ios.pro.yearly"]).toBe("PRO");
  });
});

describe("deriveTransactionStatus", () => {
  it("returns revoked when revocationDate is set", () => {
    expect(
      deriveTransactionStatus({
        revocationDate: Date.now() - DAY_MS,
        expiresDate: Date.now() + DAY_MS,
      })
    ).toBe("revoked");
  });

  it("returns active when expiresDate is in the future", () => {
    expect(deriveTransactionStatus({ expiresDate: Date.now() + DAY_MS })).toBe(
      "active"
    );
  });

  it("returns expired when expiresDate is in the past", () => {
    expect(deriveTransactionStatus({ expiresDate: Date.now() - DAY_MS })).toBe(
      "expired"
    );
  });
});

describe("isAppleEntitlementActive", () => {
  it("active with future expiry -> true", () => {
    expect(
      isAppleEntitlementActive({
        status: "active",
        expiresAt: new Date(Date.now() + DAY_MS),
      })
    ).toBe(true);
  });

  it("active with just-passed expiry within leeway -> true", () => {
    expect(
      isAppleEntitlementActive({
        status: "active",
        expiresAt: new Date(Date.now() - 60 * 1000), // 1 min ago, < 5 min leeway
      })
    ).toBe(true);
  });

  it("active with long-past expiry -> false", () => {
    expect(
      isAppleEntitlementActive({
        status: "active",
        expiresAt: new Date(Date.now() - DAY_MS),
      })
    ).toBe(false);
  });

  it("grace with recently-passed expiry -> true", () => {
    expect(
      isAppleEntitlementActive({
        status: "grace",
        expiresAt: new Date(Date.now() - 2 * DAY_MS),
      })
    ).toBe(true);
  });

  it("grace beyond the 28-day max grace window -> false", () => {
    expect(
      isAppleEntitlementActive({
        status: "grace",
        expiresAt: new Date(Date.now() - 40 * DAY_MS),
      })
    ).toBe(false);
  });

  it("billing_retry / expired / revoked -> false", () => {
    const future = new Date(Date.now() + DAY_MS);
    expect(isAppleEntitlementActive({ status: "billing_retry", expiresAt: future })).toBe(false);
    expect(isAppleEntitlementActive({ status: "expired", expiresAt: future })).toBe(false);
    expect(isAppleEntitlementActive({ status: "revoked", expiresAt: future })).toBe(false);
  });
});

describe("recomputeUserPlan", () => {
  beforeEach(() => {
    resetPrismaMock();
  });

  // =========================================
  // stripe: none
  // =========================================
  describe("stripe: none", () => {
    it("apple none -> FREE, nothing persisted", async () => {
      mockState(null, []);

      const result = await recomputeUserPlan(USER_ID);

      expect(result.plan).toBe("FREE");
      expect(prismaMock.subscription.upsert).not.toHaveBeenCalled();
    });

    it("apple active -> PRO via APPLE", async () => {
      mockState(null, [appleTx()]);

      const result = await recomputeUserPlan(USER_ID);

      expect(result.plan).toBe("PRO");
      expect(result.previousPlan).toBe("FREE");
      upsertedWith({ plan: "PRO", status: "ACTIVE", provider: "APPLE" });
    });

    it("apple grace -> PRO with PAST_DUE status", async () => {
      mockState(null, [
        appleTx({ status: "grace", expiresAt: new Date(Date.now() - DAY_MS) }),
      ]);

      const result = await recomputeUserPlan(USER_ID);

      expect(result.plan).toBe("PRO");
      upsertedWith({ plan: "PRO", status: "PAST_DUE", provider: "APPLE" });
    });

    it("apple expired -> FREE", async () => {
      mockState(null, [
        appleTx({ status: "expired", expiresAt: new Date(Date.now() - DAY_MS) }),
      ]);

      const result = await recomputeUserPlan(USER_ID);

      expect(result.plan).toBe("FREE");
      upsertedWith({ plan: "FREE", status: "CANCELED" });
    });

    it("apple revoked -> FREE", async () => {
      mockState(null, [appleTx({ status: "revoked" })]);

      const result = await recomputeUserPlan(USER_ID);

      expect(result.plan).toBe("FREE");
      upsertedWith({ plan: "FREE", status: "CANCELED" });
    });
  });

  // =========================================
  // stripe: active
  // =========================================
  describe("stripe: active", () => {
    it("apple none -> PRO via STRIPE", async () => {
      mockState(stripeSub(), []);

      const result = await recomputeUserPlan(USER_ID);

      expect(result.plan).toBe("PRO");
      upsertedWith({ plan: "PRO", status: "ACTIVE", provider: "STRIPE" });
    });

    it("apple active (same tier) -> Stripe wins the tie", async () => {
      mockState(stripeSub(), [appleTx()]);

      const result = await recomputeUserPlan(USER_ID);

      expect(result.plan).toBe("PRO");
      upsertedWith({ plan: "PRO", provider: "STRIPE" });
    });

    it("stripe ENTERPRISE beats apple PRO", async () => {
      mockState(stripeSub({ plan: "ENTERPRISE" }), [appleTx()]);

      const result = await recomputeUserPlan(USER_ID);

      expect(result.plan).toBe("ENTERPRISE");
      upsertedWith({ plan: "ENTERPRISE", provider: "STRIPE" });
    });

    it("apple grace -> Stripe still wins the tie", async () => {
      mockState(stripeSub(), [
        appleTx({ status: "grace", expiresAt: new Date(Date.now() - DAY_MS) }),
      ]);

      const result = await recomputeUserPlan(USER_ID);

      expect(result.plan).toBe("PRO");
      upsertedWith({ plan: "PRO", provider: "STRIPE" });
    });

    it("apple expired -> PRO via STRIPE", async () => {
      mockState(stripeSub(), [
        appleTx({ status: "expired", expiresAt: new Date(Date.now() - DAY_MS) }),
      ]);

      const result = await recomputeUserPlan(USER_ID);

      expect(result.plan).toBe("PRO");
      upsertedWith({ plan: "PRO", provider: "STRIPE" });
    });

    it("apple revoked -> PRO via STRIPE", async () => {
      mockState(stripeSub(), [appleTx({ status: "revoked" })]);

      const result = await recomputeUserPlan(USER_ID);

      expect(result.plan).toBe("PRO");
      upsertedWith({ plan: "PRO", provider: "STRIPE" });
    });
  });

  // =========================================
  // stripe: canceled
  // =========================================
  describe("stripe: canceled", () => {
    const canceled = () => stripeSub({ status: "CANCELED", plan: "FREE" });

    it("apple none -> FREE", async () => {
      mockState(canceled(), []);

      const result = await recomputeUserPlan(USER_ID);

      expect(result.plan).toBe("FREE");
      upsertedWith({ plan: "FREE", status: "CANCELED" });
    });

    it("apple active -> PRO via APPLE", async () => {
      mockState(canceled(), [appleTx()]);

      const result = await recomputeUserPlan(USER_ID);

      expect(result.plan).toBe("PRO");
      upsertedWith({ plan: "PRO", status: "ACTIVE", provider: "APPLE" });
    });

    it("apple grace -> PRO via APPLE (PAST_DUE)", async () => {
      mockState(canceled(), [
        appleTx({ status: "grace", expiresAt: new Date(Date.now() - DAY_MS) }),
      ]);

      const result = await recomputeUserPlan(USER_ID);

      expect(result.plan).toBe("PRO");
      upsertedWith({ plan: "PRO", status: "PAST_DUE", provider: "APPLE" });
    });

    it("apple expired -> FREE", async () => {
      mockState(canceled(), [
        appleTx({ status: "expired", expiresAt: new Date(Date.now() - DAY_MS) }),
      ]);

      const result = await recomputeUserPlan(USER_ID);

      expect(result.plan).toBe("FREE");
    });

    it("apple revoked -> FREE", async () => {
      mockState(canceled(), [appleTx({ status: "revoked" })]);

      const result = await recomputeUserPlan(USER_ID);

      expect(result.plan).toBe("FREE");
    });
  });

  // =========================================
  // stripeOverride (fresh state from the Stripe webhook)
  // =========================================
  describe("stripeOverride", () => {
    it("inactive override beats a stale ACTIVE row", async () => {
      mockState(stripeSub(), []);

      const result = await recomputeUserPlan(USER_ID, {
        stripeOverride: { active: false },
      });

      expect(result.plan).toBe("FREE");
      expect(result.previousPlan).toBe("PRO");
      upsertedWith({ plan: "FREE", status: "CANCELED" });
    });

    it("inactive override + active apple -> apple wins", async () => {
      mockState(stripeSub(), [appleTx()]);

      const result = await recomputeUserPlan(USER_ID, {
        stripeOverride: { active: false },
      });

      expect(result.plan).toBe("PRO");
      upsertedWith({ plan: "PRO", provider: "APPLE" });
    });
  });

  // =========================================
  // Apple-provider row does not ghost a Stripe entitlement
  // =========================================
  it("does not treat an APPLE-provider row as an active Stripe source", async () => {
    // Row was last written by an Apple win; Apple sub has since expired.
    mockState(
      stripeSub({ provider: "APPLE", plan: "PRO", status: "ACTIVE" }),
      [appleTx({ status: "expired", expiresAt: new Date(Date.now() - DAY_MS) })]
    );

    const result = await recomputeUserPlan(USER_ID);

    expect(result.plan).toBe("FREE");
    upsertedWith({ plan: "FREE", status: "CANCELED" });
  });

  it("ignores unmapped product ids", async () => {
    mockState(null, [appleTx({ productId: "com.queenmama.ios.unknown" })]);

    const result = await recomputeUserPlan(USER_ID);

    expect(result.plan).toBe("FREE");
  });
});
