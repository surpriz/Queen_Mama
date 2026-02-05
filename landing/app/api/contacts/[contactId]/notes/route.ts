import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { verifyAccessToken } from "@/lib/device-auth";
import { contactNoteSchema } from "@/lib/validations";

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
 * GET /api/contacts/[contactId]/notes
 * List notes for a contact
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ contactId: string }> }
) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json(
        { error: "unauthorized", message: "Authentication required" },
        { status: 401 }
      );
    }

    const { contactId } = await params;

    // Verify contact ownership
    const contact = await prisma.contact.findFirst({
      where: {
        id: contactId,
        userId,
      },
    });

    if (!contact) {
      return NextResponse.json(
        { error: "not_found", message: "Contact not found" },
        { status: 404 }
      );
    }

    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get("limit") || "20");
    const offset = parseInt(url.searchParams.get("offset") || "0");

    const [notes, total] = await Promise.all([
      prisma.contactNote.findMany({
        where: { contactId },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
        select: {
          id: true,
          content: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.contactNote.count({ where: { contactId } }),
    ]);

    return NextResponse.json({
      notes,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error("List notes error:", error);
    return NextResponse.json(
      { error: "server_error", message: "Failed to list notes" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/contacts/[contactId]/notes
 * Add a note to a contact
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ contactId: string }> }
) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json(
        { error: "unauthorized", message: "Authentication required" },
        { status: 401 }
      );
    }

    const { contactId } = await params;

    // Verify contact ownership
    const contact = await prisma.contact.findFirst({
      where: {
        id: contactId,
        userId,
      },
    });

    if (!contact) {
      return NextResponse.json(
        { error: "not_found", message: "Contact not found" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const parsed = contactNoteSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "invalid_request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const note = await prisma.contactNote.create({
      data: {
        contactId,
        userId,
        content: parsed.data.content,
      },
      select: {
        id: true,
        content: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ note }, { status: 201 });
  } catch (error) {
    console.error("Create note error:", error);
    return NextResponse.json(
      { error: "server_error", message: "Failed to create note" },
      { status: 500 }
    );
  }
}
