// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { prismaMock, resetPrismaMock } from "@/tests/helpers/prisma-mock";
import { VALID_UUID } from "@/tests/helpers/fixtures";

// Mock device-auth (same pattern as license.test.ts)
const mockVerifyAccessToken = vi.fn();
vi.mock("@/lib/device-auth", () => ({
  verifyAccessToken: (...args: unknown[]) => mockVerifyAccessToken(...args),
}));

// Mock only the verifier — upsertAppleTransaction / recomputeUserPlan stay real
const mockVerifyTransaction = vi.fn();
vi.mock("@/lib/apple-iap", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/apple-iap")>();
  return {
    ...actual,
    getAppleVerifier: () => ({
      verifyAndDecodeTransaction: mockVerifyTransaction,
    }),
  };
});

import { POST } from "@/app/api/billing/apple/transaction/route";
import { GET as getAppAccountToken } from "@/app/api/billing/apple/app-account-token/route";

const USER_ID = "test-user-id-123";
const DAY_MS = 24 * 60 * 60 * 1000;

const tokenPayload = {
  sub: USER_ID,
  email: "test@example.com",
  name: "Test User",
  role: "USER",
  deviceId: VALID_UUID,
};

function makeRequest(body: unknown, token = "valid-token"): Request {
  return new Request("http://localhost:3000/api/billing/apple/transaction", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
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

describe("POST /api/billing/apple/transaction", () => {
  beforeEach(() => {
    resetPrismaMock();
    mockVerifyAccessToken.mockReset();
    mockVerifyAccessToken.mockResolvedValue(tokenPayload);
    mockVerifyTransaction.mockReset();
  });

  it("returns 401 without Authorization header", async () => {
    const req = new Request("http://localhost:3000/api/billing/apple/transaction", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ signedTransaction: "ey..." }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 401 for an invalid access token", async () => {
    mockVerifyAccessToken.mockRejectedValue(new Error("invalid"));

    const res = await POST(makeRequest({ signedTransaction: "ey..." }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when signedTransaction is missing", async () => {
    const res = await POST(makeRequest({}));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("invalid_request");
  });

  it("returns 400 when JWS verification fails", async () => {
    mockVerifyTransaction.mockRejectedValue(new Error("bad signature"));

    const res = await POST(makeRequest({ signedTransaction: "ey..." }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("invalid_transaction");
  });

  it("returns 409 when the transaction belongs to another user", async () => {
    mockVerifyTransaction.mockResolvedValue(decodedTransaction());
    prismaMock.appleTransaction.findUnique.mockResolvedValue({
      originalTransactionId: "apple-orig-1",
      userId: "someone-else",
    } as never);

    const res = await POST(makeRequest({ signedTransaction: "ey..." }));
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json.error).toBe("transaction_conflict");
    expect(prismaMock.appleTransaction.upsert).not.toHaveBeenCalled();
  });

  it("binds the transaction, backfills appAccountToken and returns the plan", async () => {
    const decoded = decodedTransaction({
      appAccountToken: "9f1c2e34-0000-4000-8000-000000000001",
    });
    mockVerifyTransaction.mockResolvedValue(decoded);

    prismaMock.appleTransaction.findUnique.mockResolvedValue(null);
    prismaMock.appleTransaction.upsert.mockResolvedValue({} as never);
    prismaMock.user.updateMany.mockResolvedValue({ count: 1 } as never);

    // recomputeUserPlan
    prismaMock.subscription.findUnique.mockResolvedValue(null);
    prismaMock.appleTransaction.findMany.mockResolvedValue([
      {
        originalTransactionId: "apple-orig-1",
        userId: USER_ID,
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

    const res = await POST(makeRequest({ signedTransaction: "ey..." }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ ok: true, plan: "PRO" });
    expect(prismaMock.appleTransaction.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { originalTransactionId: "apple-orig-1" },
        create: expect.objectContaining({ userId: USER_ID, status: "active" }),
      })
    );
    expect(prismaMock.user.updateMany).toHaveBeenCalledWith({
      where: { id: USER_ID, appAccountToken: null },
      data: { appAccountToken: "9f1c2e34-0000-4000-8000-000000000001" },
    });
    expect(prismaMock.subscription.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: USER_ID },
        update: expect.objectContaining({ plan: "PRO", provider: "APPLE" }),
      })
    );
  });

  it("re-claims an orphan transaction for the authenticated user", async () => {
    mockVerifyTransaction.mockResolvedValue(decodedTransaction());
    prismaMock.appleTransaction.findUnique.mockResolvedValue({
      originalTransactionId: "apple-orig-1",
      userId: null,
    } as never);
    prismaMock.appleTransaction.upsert.mockResolvedValue({} as never);
    prismaMock.subscription.findUnique.mockResolvedValue(null);
    prismaMock.appleTransaction.findMany.mockResolvedValue([]);

    const res = await POST(makeRequest({ signedTransaction: "ey..." }));

    expect(res.status).toBe(200);
    expect(prismaMock.appleTransaction.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ userId: USER_ID }),
      })
    );
  });
});

describe("GET /api/billing/apple/app-account-token", () => {
  beforeEach(() => {
    resetPrismaMock();
    mockVerifyAccessToken.mockReset();
    mockVerifyAccessToken.mockResolvedValue(tokenPayload);
  });

  function makeGetRequest(token = "valid-token"): Request {
    return new Request(
      "http://localhost:3000/api/billing/apple/app-account-token",
      { method: "GET", headers: { Authorization: `Bearer ${token}` } }
    );
  }

  it("returns 401 without Authorization header", async () => {
    const res = await getAppAccountToken(
      new Request("http://localhost:3000/api/billing/apple/app-account-token")
    );
    expect(res.status).toBe(401);
  });

  it("returns the existing token without regenerating", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: USER_ID,
      appAccountToken: "existing-token-uuid",
    } as never);

    const res = await getAppAccountToken(makeGetRequest());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.appAccountToken).toBe("existing-token-uuid");
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it("generates and persists a uuid when missing", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: USER_ID,
      appAccountToken: null,
    } as never);
    prismaMock.user.update.mockResolvedValue({} as never);

    const res = await getAppAccountToken(makeGetRequest());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.appAccountToken).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: USER_ID },
      data: { appAccountToken: json.appAccountToken },
    });
  });

  it("returns 404 when the user does not exist", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    const res = await getAppAccountToken(makeGetRequest());
    expect(res.status).toBe(404);
  });
});
