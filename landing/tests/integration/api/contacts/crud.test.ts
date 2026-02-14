// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { prismaMock, resetPrismaMock } from "@/tests/helpers/prisma-mock";

// Mock device-auth for Bearer token verification
vi.mock("@/lib/device-auth", () => ({
  verifyAccessToken: vi.fn().mockResolvedValue({
    sub: "user-123",
    email: "test@example.com",
    name: "Test User",
    role: "USER",
    deviceId: "device-456",
  }),
  signAccessToken: vi.fn(),
  generateRefreshToken: vi.fn(),
  hashRefreshToken: vi.fn(),
  AUTH_CONSTANTS: { MAX_DEVICES_PER_USER: 5 },
}));

// Mock auth for session-based auth
vi.mock("@/lib/auth", () => ({
  auth: vi.fn().mockResolvedValue(null),
  handlers: { GET: vi.fn(), POST: vi.fn() },
}));

import { GET, POST } from "@/app/api/contacts/route";
import { verifyAccessToken } from "@/lib/device-auth";
import { auth } from "@/lib/auth";

function makeGetRequest(params: Record<string, string> = {}, token?: string): Request {
  const url = new URL("http://localhost:3000/api/contacts");
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return new Request(url.toString(), { method: "GET", headers });
}

function makePostRequest(body: unknown, token?: string): Request {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return new Request("http://localhost:3000/api/contacts", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

function resetAuthMocks() {
  vi.mocked(verifyAccessToken).mockReset();
  vi.mocked(verifyAccessToken).mockResolvedValue({
    sub: "user-123",
    email: "test@example.com",
    name: "Test User",
    role: "USER",
    deviceId: "device-456",
  } as never);
  vi.mocked(auth).mockReset();
  vi.mocked(auth).mockResolvedValue(null as never);
}

describe("GET /api/contacts", () => {
  beforeEach(() => {
    resetPrismaMock();
    resetAuthMocks();
  });

  it("returns paginated contacts for authenticated user", async () => {
    const contacts = [
      {
        id: "c1",
        firstName: "John",
        lastName: "Doe",
        email: "john@test.com",
        company: "Acme",
        role: "CTO",
        lastSeenAt: new Date(),
        createdAt: new Date(),
        _count: { sessions: 3, notes: 1 },
      },
    ];

    prismaMock.contact.findMany.mockResolvedValue(contacts as never);
    prismaMock.contact.count.mockResolvedValue(1);

    const res = await GET(makeGetRequest({}, "valid-token"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.contacts).toHaveLength(1);
    expect(data.total).toBe(1);
    expect(data.page).toBe(1);
    expect(data.totalPages).toBe(1);
  });

  it("supports search parameter", async () => {
    prismaMock.contact.findMany.mockResolvedValue([] as never);
    prismaMock.contact.count.mockResolvedValue(0);

    await GET(makeGetRequest({ search: "John" }, "valid-token"));

    expect(prismaMock.contact.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: "user-123",
          OR: expect.arrayContaining([
            expect.objectContaining({
              firstName: { contains: "John", mode: "insensitive" },
            }),
          ]),
        }),
      })
    );
  });

  it("supports pagination", async () => {
    prismaMock.contact.findMany.mockResolvedValue([] as never);
    prismaMock.contact.count.mockResolvedValue(100);

    const res = await GET(makeGetRequest({ page: "3", limit: "10" }, "valid-token"));
    const data = await res.json();

    expect(data.page).toBe(3);
    expect(data.limit).toBe(10);
    expect(data.totalPages).toBe(10);

    expect(prismaMock.contact.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 10,
        skip: 20, // (3-1) * 10
      })
    );
  });

  it("returns 401 for unauthenticated request", async () => {
    vi.mocked(verifyAccessToken).mockRejectedValueOnce(new Error("Invalid token"));
    vi.mocked(auth).mockResolvedValueOnce(null as never);

    const res = await GET(makeGetRequest());
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBe("unauthorized");
  });

  it("supports NextAuth session authentication", async () => {
    vi.mocked(verifyAccessToken).mockRejectedValueOnce(new Error("No token"));
    vi.mocked(auth).mockResolvedValueOnce({
      user: { id: "session-user", email: "s@test.com", name: "S", role: "USER" },
      expires: new Date(Date.now() + 86400000).toISOString(),
    } as never);

    prismaMock.contact.findMany.mockResolvedValue([] as never);
    prismaMock.contact.count.mockResolvedValue(0);

    const res = await GET(makeGetRequest());
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(prismaMock.contact.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: "session-user" }),
      })
    );
  });

  it("orders contacts by lastSeenAt desc", async () => {
    prismaMock.contact.findMany.mockResolvedValue([] as never);
    prismaMock.contact.count.mockResolvedValue(0);

    await GET(makeGetRequest({}, "valid-token"));

    expect(prismaMock.contact.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { lastSeenAt: "desc" },
      })
    );
  });
});

describe("POST /api/contacts", () => {
  beforeEach(() => {
    resetPrismaMock();
    resetAuthMocks();
  });

  it("creates a contact with valid data", async () => {
    prismaMock.contact.findUnique.mockResolvedValue(null);
    prismaMock.contact.create.mockResolvedValue({
      id: "new-contact",
      firstName: "Jane",
      lastName: "Smith",
      email: "jane@test.com",
      company: "Acme",
      role: "CEO",
      lastSeenAt: new Date(),
      createdAt: new Date(),
    } as never);

    const res = await POST(
      makePostRequest(
        {
          firstName: "Jane",
          lastName: "Smith",
          email: "jane@test.com",
          company: "Acme",
          role: "CEO",
        },
        "valid-token"
      )
    );
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.contact.firstName).toBe("Jane");
  });

  it("creates contact with only firstName", async () => {
    prismaMock.contact.create.mockResolvedValue({
      id: "new-contact",
      firstName: "Jane",
      lastName: null,
      email: null,
      company: null,
      role: null,
      lastSeenAt: new Date(),
      createdAt: new Date(),
    } as never);

    const res = await POST(
      makePostRequest({ firstName: "Jane" }, "valid-token")
    );

    expect(res.status).toBe(201);
  });

  it("rejects duplicate email for same user", async () => {
    prismaMock.contact.findUnique.mockResolvedValue({
      id: "existing-contact",
    } as never);

    const res = await POST(
      makePostRequest(
        { firstName: "Jane", email: "existing@test.com" },
        "valid-token"
      )
    );
    const data = await res.json();

    expect(res.status).toBe(409);
    expect(data.error).toBe("duplicate_email");
  });

  it("returns 401 for unauthenticated request", async () => {
    const { verifyAccessToken } = await import("@/lib/device-auth");
    vi.mocked(verifyAccessToken).mockRejectedValueOnce(new Error("Invalid token"));
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(null as never);

    const res = await POST(
      makePostRequest({ firstName: "Jane" })
    );

    expect(res.status).toBe(401);
  });

  it("returns 400 for missing firstName", async () => {
    const res = await POST(
      makePostRequest({ lastName: "Smith" }, "valid-token")
    );

    expect(res.status).toBe(400);
  });

  it("returns 500 on database error", async () => {
    prismaMock.contact.create.mockRejectedValue(new Error("DB down"));

    const res = await POST(
      makePostRequest({ firstName: "Jane" }, "valid-token")
    );

    expect(res.status).toBe(500);
  });
});
