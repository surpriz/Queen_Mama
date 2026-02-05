import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAccessToken } from "@/lib/device-auth";
import { contactSyncSchema, contactSyncBatchSchema } from "@/lib/validations";

/**
 * POST /api/sync/contacts
 * Upload contact(s) from macOS app
 * Requires PRO subscription for sync
 */
export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "unauthorized", message: "Missing authorization header" },
        { status: 401 }
      );
    }

    const accessToken = authHeader.slice(7);

    let tokenPayload;
    try {
      tokenPayload = await verifyAccessToken(accessToken);
    } catch {
      return NextResponse.json(
        { error: "invalid_token", message: "Invalid or expired token" },
        { status: 401 }
      );
    }

    // Check subscription for sync feature
    const user = await prisma.user.findUnique({
      where: { id: tokenPayload.sub },
      include: { subscription: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: "user_not_found" },
        { status: 404 }
      );
    }

    if (user.role === "BLOCKED") {
      return NextResponse.json(
        { error: "account_blocked" },
        { status: 403 }
      );
    }

    // Contact sync requires PRO or higher
    if (!user.subscription || user.subscription.plan === "FREE") {
      return NextResponse.json(
        { error: "subscription_required", message: "Contact sync requires PRO subscription" },
        { status: 403 }
      );
    }

    const body = await request.json();

    // Determine if batch or single contact
    let contacts: typeof contactSyncSchema._output[];

    if (body.contacts) {
      const parsed = contactSyncBatchSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: "invalid_request", details: parsed.error.flatten() },
          { status: 400 }
        );
      }
      contacts = parsed.data.contacts;
    } else {
      const parsed = contactSyncSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: "invalid_request", details: parsed.error.flatten() },
          { status: 400 }
        );
      }
      contacts = [parsed.data];
    }

    const results = [];
    const errors = [];

    for (const contact of contacts) {
      try {
        // Verify device matches token
        if (contact.deviceId !== tokenPayload.deviceId) {
          errors.push({
            originalId: contact.originalId,
            error: "device_mismatch",
          });
          continue;
        }

        // Check for existing contact by email (if provided)
        let existingContact = null;
        if (contact.email) {
          existingContact = await prisma.contact.findUnique({
            where: {
              userId_email: {
                userId: user.id,
                email: contact.email,
              },
            },
          });
        }

        let syncedContact;

        if (existingContact) {
          // Update existing contact
          syncedContact = await prisma.contact.update({
            where: { id: existingContact.id },
            data: {
              firstName: contact.firstName,
              lastName: contact.lastName || null,
              company: contact.company || null,
              role: contact.role || null,
              lastSeenAt: contact.lastSeenAt ? new Date(contact.lastSeenAt) : new Date(),
            },
          });
        } else {
          // Create new contact
          syncedContact = await prisma.contact.create({
            data: {
              userId: user.id,
              firstName: contact.firstName,
              lastName: contact.lastName || null,
              email: contact.email || null,
              company: contact.company || null,
              role: contact.role || null,
              lastSeenAt: contact.lastSeenAt ? new Date(contact.lastSeenAt) : new Date(),
            },
          });
        }

        // Sync notes if provided
        if (contact.notes?.length) {
          for (const note of contact.notes) {
            await prisma.contactNote.upsert({
              where: {
                id: `${syncedContact.id}-${note.originalId}`,
              },
              update: {
                content: note.content,
              },
              create: {
                id: `${syncedContact.id}-${note.originalId}`,
                contactId: syncedContact.id,
                userId: user.id,
                content: note.content,
                createdAt: new Date(note.createdAt),
              },
            });
          }
        }

        results.push({
          originalId: contact.originalId,
          syncedId: syncedContact.id,
          status: existingContact ? "updated" : "created",
        });
      } catch (error) {
        console.error("Contact sync error:", error);
        errors.push({
          originalId: contact.originalId,
          error: "sync_failed",
        });
      }
    }

    return NextResponse.json({
      synced: results.length,
      failed: errors.length,
      results,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("Sync contacts endpoint error:", error);
    return NextResponse.json(
      { error: "server_error", message: "Sync failed" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/sync/contacts
 * Get contacts for bidirectional sync
 */
export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "unauthorized" },
        { status: 401 }
      );
    }

    const accessToken = authHeader.slice(7);

    let tokenPayload;
    try {
      tokenPayload = await verifyAccessToken(accessToken);
    } catch {
      return NextResponse.json(
        { error: "invalid_token" },
        { status: 401 }
      );
    }

    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get("limit") || "100");
    const offset = parseInt(url.searchParams.get("offset") || "0");
    const includeNotes = url.searchParams.get("includeNotes") === "true";

    const [contacts, count] = await Promise.all([
      prisma.contact.findMany({
        where: { userId: tokenPayload.sub },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          company: true,
          role: true,
          lastSeenAt: true,
          createdAt: true,
          updatedAt: true,
          ...(includeNotes && {
            notes: {
              select: {
                id: true,
                content: true,
                createdAt: true,
              },
              orderBy: { createdAt: "desc" as const },
            },
          }),
        },
        orderBy: { updatedAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.contact.count({ where: { userId: tokenPayload.sub } }),
    ]);

    return NextResponse.json({
      contacts,
      total: count,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Get contacts for sync error:", error);
    return NextResponse.json(
      { error: "server_error" },
      { status: 500 }
    );
  }
}
