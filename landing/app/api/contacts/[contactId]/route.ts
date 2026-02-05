import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { verifyAccessToken } from "@/lib/device-auth";
import { contactUpdateSchema } from "@/lib/validations";

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
 * GET /api/contacts/[contactId]
 * Get contact details with notes and session count
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

    const contact = await prisma.contact.findFirst({
      where: {
        id: contactId,
        userId,
      },
      include: {
        notes: {
          orderBy: { createdAt: "desc" },
          take: 10,
          select: {
            id: true,
            content: true,
            createdAt: true,
          },
        },
        sessions: {
          orderBy: { createdAt: "desc" },
          take: 10,
          select: {
            id: true,
            sessionId: true,
            session: {
              select: {
                id: true,
                title: true,
                startTime: true,
                duration: true,
                summary: true,
              },
            },
          },
        },
        _count: {
          select: {
            sessions: true,
            notes: true,
          },
        },
      },
    });

    if (!contact) {
      return NextResponse.json(
        { error: "not_found", message: "Contact not found" },
        { status: 404 }
      );
    }

    // Return flat contact object (compatible with both macOS app and web dashboard)
    return NextResponse.json({
      id: contact.id,
      firstName: contact.firstName,
      lastName: contact.lastName,
      email: contact.email,
      company: contact.company,
      role: contact.role,
      lastSeenAt: contact.lastSeenAt,
      createdAt: contact.createdAt,
      notes: contact.notes,
      sessions: contact.sessions,
      _count: contact._count,
    });
  } catch (error) {
    console.error("Get contact error:", error);
    return NextResponse.json(
      { error: "server_error", message: "Failed to get contact" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/contacts/[contactId]
 * Update contact details
 */
export async function PATCH(
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

    // Verify ownership
    const existing = await prisma.contact.findFirst({
      where: {
        id: contactId,
        userId,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "not_found", message: "Contact not found" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const parsed = contactUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "invalid_request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { firstName, lastName, email, company, role } = parsed.data;

    // Check for duplicate email if changing
    if (email && email !== existing.email) {
      const duplicate = await prisma.contact.findUnique({
        where: {
          userId_email: {
            userId,
            email,
          },
        },
      });

      if (duplicate) {
        return NextResponse.json(
          { error: "duplicate_email", message: "A contact with this email already exists" },
          { status: 409 }
        );
      }
    }

    const contact = await prisma.contact.update({
      where: { id: contactId },
      data: {
        ...(firstName !== undefined && { firstName }),
        ...(lastName !== undefined && { lastName: lastName || null }),
        ...(email !== undefined && { email: email || null }),
        ...(company !== undefined && { company: company || null }),
        ...(role !== undefined && { role: role || null }),
      },
      include: {
        notes: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
        sessions: {
          orderBy: { createdAt: "desc" },
          take: 10,
          include: {
            session: true,
          },
        },
      },
    });

    return NextResponse.json(contact);
  } catch (error) {
    console.error("Update contact error:", error);
    return NextResponse.json(
      { error: "server_error", message: "Failed to update contact" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/contacts/[contactId]
 * Delete a contact
 */
export async function DELETE(
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

    // Verify ownership
    const existing = await prisma.contact.findFirst({
      where: {
        id: contactId,
        userId,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "not_found", message: "Contact not found" },
        { status: 404 }
      );
    }

    await prisma.contact.delete({
      where: { id: contactId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete contact error:", error);
    return NextResponse.json(
      { error: "server_error", message: "Failed to delete contact" },
      { status: 500 }
    );
  }
}
