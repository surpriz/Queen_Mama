// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { prismaMock, resetPrismaMock } from "@/tests/helpers/prisma-mock";

// Mock Stripe
const mockConstructEvent = vi.fn();
const mockSubscriptionsRetrieve = vi.fn();
const mockSubscriptionsCancel = vi.fn();

vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({
    webhooks: {
      constructEvent: mockConstructEvent,
    },
    subscriptions: {
      retrieve: mockSubscriptionsRetrieve,
      cancel: mockSubscriptionsCancel,
    },
  }),
}));

// Mock next/headers
vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(
    new Map([["stripe-signature", "mock-sig"]])
  ),
}));

import { POST } from "@/app/api/webhooks/stripe/route";

function makeRequest(body = "raw-body"): Request {
  return new Request("http://localhost:3000/api/webhooks/stripe", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "stripe-signature": "mock-sig",
    },
    body,
  });
}

describe("POST /api/webhooks/stripe", () => {
  beforeEach(() => {
    resetPrismaMock();
    mockConstructEvent.mockReset();
    mockSubscriptionsRetrieve.mockReset();
    mockSubscriptionsCancel.mockReset();
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
  });

  describe("checkout.session.completed", () => {
    it("creates subscription for new user", async () => {
      mockConstructEvent.mockReturnValue({
        type: "checkout.session.completed",
        data: {
          object: {
            metadata: { userId: "user-1", plan: "PRO" },
            subscription: "sub_new",
            customer: "cus_123",
          },
        },
      });

      mockSubscriptionsRetrieve.mockResolvedValue({
        id: "sub_new",
        status: "active",
        items: { data: [{ price: { id: "price_pro" } }] },
        current_period_start: Math.floor(Date.now() / 1000),
        current_period_end: Math.floor(Date.now() / 1000) + 30 * 86400,
      });

      prismaMock.subscription.findUnique.mockResolvedValue(null);
      prismaMock.user.update.mockResolvedValue({} as never);
      prismaMock.subscription.upsert.mockResolvedValue({} as never);

      const res = await POST(makeRequest());
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.received).toBe(true);
      expect(prismaMock.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "user-1" },
          data: { stripeCustomerId: "cus_123" },
        })
      );
      expect(prismaMock.subscription.upsert).toHaveBeenCalled();
    });

    it("cancels old subscription when upgrading", async () => {
      mockConstructEvent.mockReturnValue({
        type: "checkout.session.completed",
        data: {
          object: {
            metadata: { userId: "user-1", plan: "ENTERPRISE" },
            subscription: "sub_new",
            customer: "cus_123",
          },
        },
      });

      mockSubscriptionsRetrieve.mockResolvedValue({
        id: "sub_new",
        status: "active",
        items: { data: [{ price: { id: "price_ent" } }] },
        current_period_start: Math.floor(Date.now() / 1000),
        current_period_end: Math.floor(Date.now() / 1000) + 30 * 86400,
      });

      prismaMock.subscription.findUnique.mockResolvedValue({
        id: "old-sub",
        stripeSubscriptionId: "sub_old",
      } as never);
      prismaMock.user.update.mockResolvedValue({} as never);
      prismaMock.subscription.upsert.mockResolvedValue({} as never);

      await POST(makeRequest());

      expect(mockSubscriptionsCancel).toHaveBeenCalledWith("sub_old");
    });

    it("defaults to PRO plan when not ENTERPRISE", async () => {
      mockConstructEvent.mockReturnValue({
        type: "checkout.session.completed",
        data: {
          object: {
            metadata: { userId: "user-1", plan: "PRO" },
            subscription: "sub_new",
            customer: "cus_123",
          },
        },
      });

      mockSubscriptionsRetrieve.mockResolvedValue({
        id: "sub_new",
        status: "active",
        items: { data: [{ price: { id: "price_pro" } }] },
        current_period_start: Math.floor(Date.now() / 1000),
        current_period_end: Math.floor(Date.now() / 1000) + 30 * 86400,
      });

      prismaMock.subscription.findUnique.mockResolvedValue(null);
      prismaMock.user.update.mockResolvedValue({} as never);
      prismaMock.subscription.upsert.mockResolvedValue({} as never);

      await POST(makeRequest());

      expect(prismaMock.subscription.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ plan: "PRO" }),
        })
      );
    });
  });

  describe("customer.subscription.updated", () => {
    it("updates subscription status", async () => {
      mockConstructEvent.mockReturnValue({
        type: "customer.subscription.updated",
        data: {
          object: {
            id: "sub_123",
            status: "active",
            cancel_at_period_end: false,
            cancel_at: null,
            current_period_start: Math.floor(Date.now() / 1000),
            current_period_end: Math.floor(Date.now() / 1000) + 30 * 86400,
          },
        },
      });

      prismaMock.subscription.findUnique.mockResolvedValue({
        id: "sub-db-id",
        stripeSubscriptionId: "sub_123",
      } as never);
      prismaMock.subscription.update.mockResolvedValue({} as never);

      const res = await POST(makeRequest());

      expect(res.status).toBe(200);
      expect(prismaMock.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { stripeSubscriptionId: "sub_123" },
          data: expect.objectContaining({
            status: "ACTIVE",
            cancelAtPeriodEnd: false,
          }),
        })
      );
    });

    it("handles cancel_at_period_end flag", async () => {
      mockConstructEvent.mockReturnValue({
        type: "customer.subscription.updated",
        data: {
          object: {
            id: "sub_123",
            status: "active",
            cancel_at_period_end: true,
            cancel_at: null,
            current_period_start: Math.floor(Date.now() / 1000),
            current_period_end: Math.floor(Date.now() / 1000) + 30 * 86400,
          },
        },
      });

      prismaMock.subscription.findUnique.mockResolvedValue({
        id: "sub-db-id",
      } as never);
      prismaMock.subscription.update.mockResolvedValue({} as never);

      await POST(makeRequest());

      expect(prismaMock.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ cancelAtPeriodEnd: true }),
        })
      );
    });
  });

  describe("customer.subscription.deleted", () => {
    it("marks subscription as canceled and downgrades to FREE", async () => {
      mockConstructEvent.mockReturnValue({
        type: "customer.subscription.deleted",
        data: {
          object: { id: "sub_123" },
        },
      });

      prismaMock.subscription.update.mockResolvedValue({} as never);

      const res = await POST(makeRequest());

      expect(res.status).toBe(200);
      expect(prismaMock.subscription.update).toHaveBeenCalledWith({
        where: { stripeSubscriptionId: "sub_123" },
        data: { status: "CANCELED", plan: "FREE" },
      });
    });
  });

  describe("signature validation", () => {
    it("rejects invalid signature", async () => {
      mockConstructEvent.mockImplementation(() => {
        throw new Error("Invalid signature");
      });

      const res = await POST(makeRequest());
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toBe("Invalid signature");
    });
  });

  describe("error handling", () => {
    it("returns 500 on handler error", async () => {
      mockConstructEvent.mockReturnValue({
        type: "checkout.session.completed",
        data: {
          object: {
            metadata: { userId: "user-1", plan: "PRO" },
            subscription: "sub_new",
            customer: "cus_123",
          },
        },
      });

      mockSubscriptionsRetrieve.mockRejectedValue(new Error("Stripe API down"));

      const res = await POST(makeRequest());

      expect(res.status).toBe(500);
    });
  });
});
