import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { verifyAccessToken } from "@/lib/device-auth";
import { contactCreateSchema, contactQuerySchema } from "@/lib/validations";

/**
 * Get user ID from either Bearer token or session
 */
async function getUserId(request: Request): Promise<string | null> {
  // First try Bearer token (for macOS app)
  const authHeader = request.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const accessToken = authHeader.slice(7);
    try {
      const tokenPayload = await verifyAccessToken(accessToken);
      return tokenPayload.sub;
    } catch {
      // Token invalid, fall through to session auth
    }
  }

  // Try NextAuth session (for web dashboard)
  const session = await auth();
  if (session?.user?.id) {
    return session.user.id;
  }

  return null;
}

/**
 * GET /api/contacts
 * List contacts with search and pagination
 */
export async function GET(request: Request) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json(
        { error: "unauthorized", message: "Authentication required" },
        { status: 401 }
      );
    }

    const url = new URL(request.url);
    const parsed = contactQuerySchema.safeParse({
      page: url.searchParams.get("page") || "1",
      limit: url.searchParams.get("limit") || "50",
      search: url.searchParams.get("search") || undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "invalid_request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { page, limit, search } = parsed.data;
    const offset = (page - 1) * limit;

    // Build where clause with optional search
    const whereClause: {
      userId: string;
      OR?: Array<{
        firstName?: { contains: string; mode: "insensitive" };
        lastName?: { contains: string; mode: "insensitive" };
        email?: { contains: string; mode: "insensitive" };
        company?: { contains: string; mode: "insensitive" };
      }>;
    } = {
      userId,
    };

    if (search) {
      whereClause.OR = [
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { company: { contains: search, mode: "insensitive" } },
      ];
    }

    const [contacts, total] = await Promise.all([
      prisma.contact.findMany({
        where: whereClause,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          company: true,
          role: true,
          lastSeenAt: true,
          createdAt: true,
          _count: {
            select: {
              sessions: true,
              notes: true,
            },
          },
        },
        orderBy: { lastSeenAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.contact.count({ where: whereClause }),
    ]);

    return NextResponse.json({
      contacts,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("List contacts error:", error);
    return NextResponse.json(
      { error: "server_error", message: "Failed to list contacts" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/contacts
 * Create a new contact
 */
export async function POST(request: Request) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json(
        { error: "unauthorized", message: "Authentication required" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const parsed = contactCreateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "invalid_request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { firstName, lastName, email, company, role } = parsed.data;

    // Check for duplicate email if provided
    if (email) {
      const existing = await prisma.contact.findUnique({
        where: {
          userId_email: {
            userId,
            email,
          },
        },
      });

      if (existing) {
        return NextResponse.json(
          { error: "duplicate_email", message: "A contact with this email already exists" },
          { status: 409 }
        );
      }
    }

    const contact = await prisma.contact.create({
      data: {
        userId,
        firstName,
        lastName: lastName || null,
        email: email || null,
        company: company || null,
        role: role || null,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        company: true,
        role: true,
        lastSeenAt: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ contact }, { status: 201 });
  } catch (error) {
    console.error("Create contact error:", error);
    return NextResponse.json(
      { error: "server_error", message: "Failed to create contact" },
      { status: 500 }
    );
  }
}
