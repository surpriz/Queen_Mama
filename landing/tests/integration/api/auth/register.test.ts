// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { prismaMock, resetPrismaMock } from "@/tests/helpers/prisma-mock";

// Mock bcryptjs
vi.mock("bcryptjs", () => ({
  default: {
    hash: vi.fn().mockResolvedValue("$2a$12$hashed_password"),
  },
}));

// Mock verification email
vi.mock("@/app/api/auth/verify-email/route", () => ({
  generateAndSendVerificationEmail: vi.fn().mockResolvedValue(undefined),
}));

import { POST } from "@/app/api/auth/register/route";

function makeRequest(body: unknown): Request {
  return new Request("http://localhost:3000/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/register", () => {
  beforeEach(() => {
    resetPrismaMock();
  });

  it("creates user with valid data", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.user.create.mockResolvedValue({
      id: "new-user-id",
      name: "Test User",
      email: "new@example.com",
    } as never);

    const res = await POST(
      makeRequest({
        name: "Test User",
        email: "new@example.com",
        password: "StrongPass123",
      })
    );
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.id).toBe("new-user-id");
    expect(data.email).toBe("new@example.com");
    expect(data.message).toContain("Account created");
  });

  it("creates a FREE subscription for new user", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.user.create.mockResolvedValue({
      id: "new-user-id",
      name: "Test",
      email: "new@example.com",
    } as never);

    await POST(
      makeRequest({
        name: "Test",
        email: "new@example.com",
        password: "StrongPass123",
      })
    );

    expect(prismaMock.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          subscription: {
            create: { plan: "FREE", status: "ACTIVE" },
          },
        }),
      })
    );
  });

  it("rejects duplicate email", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "existing-id",
      email: "taken@example.com",
    } as never);

    const res = await POST(
      makeRequest({
        name: "Test",
        email: "taken@example.com",
        password: "StrongPass123",
      })
    );
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("already exists");
  });

  it("rejects invalid email format", async () => {
    const res = await POST(
      makeRequest({
        name: "Test",
        email: "not-an-email",
        password: "StrongPass123",
      })
    );

    expect(res.status).toBe(400);
  });

  it("rejects weak password", async () => {
    const res = await POST(
      makeRequest({
        name: "Test",
        email: "test@example.com",
        password: "weak",
      })
    );

    expect(res.status).toBe(400);
  });

  it("rejects missing name", async () => {
    const res = await POST(
      makeRequest({
        email: "test@example.com",
        password: "StrongPass123",
      })
    );

    expect(res.status).toBe(400);
  });

  it("hashes password with bcrypt", async () => {
    const bcrypt = await import("bcryptjs");
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.user.create.mockResolvedValue({
      id: "new-user-id",
      name: "Test",
      email: "new@example.com",
    } as never);

    await POST(
      makeRequest({
        name: "Test",
        email: "new@example.com",
        password: "StrongPass123",
      })
    );

    expect(bcrypt.default.hash).toHaveBeenCalledWith("StrongPass123", 12);
  });

  it("sends verification email on success", async () => {
    const { generateAndSendVerificationEmail } = await import(
      "@/app/api/auth/verify-email/route"
    );
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.user.create.mockResolvedValue({
      id: "new-user-id",
      name: "Test User",
      email: "new@example.com",
    } as never);

    await POST(
      makeRequest({
        name: "Test User",
        email: "new@example.com",
        password: "StrongPass123",
      })
    );

    expect(generateAndSendVerificationEmail).toHaveBeenCalledWith(
      "new@example.com",
      "Test User"
    );
  });

  it("still creates user if verification email fails", async () => {
    const { generateAndSendVerificationEmail } = await import(
      "@/app/api/auth/verify-email/route"
    );
    (generateAndSendVerificationEmail as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("Email service down")
    );
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.user.create.mockResolvedValue({
      id: "new-user-id",
      name: "Test",
      email: "new@example.com",
    } as never);

    const res = await POST(
      makeRequest({
        name: "Test",
        email: "new@example.com",
        password: "StrongPass123",
      })
    );

    expect(res.status).toBe(201);
  });

  it("returns 500 on database error", async () => {
    prismaMock.user.findUnique.mockRejectedValue(new Error("DB down"));

    const res = await POST(
      makeRequest({
        name: "Test",
        email: "new@example.com",
        password: "StrongPass123",
      })
    );

    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe("Something went wrong");
  });
});
