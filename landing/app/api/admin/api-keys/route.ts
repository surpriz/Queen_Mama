import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encryptApiKey, getKeyPrefix } from "@/lib/encryption";
import { ApiKeyProvider } from "@prisma/client";

// Middleware to check admin role
async function requireAdmin() {
  const session = await auth();

  if (!session?.user?.email) {
    return { error: "Unauthorized", status: 401 };
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, role: true },
  });

  if (!user || user.role !== "ADMIN") {
    return { error: "Forbidden - Admin access required", status: 403 };
  }

  return { user };
}

// GET - List all admin API keys (without actual key values)
export async function GET(request: NextRequest) {
  const adminAuth = await requireAdmin();
  if ("error" in adminAuth) {
    return NextResponse.json({ error: adminAuth.error }, { status: adminAuth.status });
  }

  try {
    const apiKeys = await prisma.adminApiKey.findMany({
      orderBy: { provider: "asc" },
      select: {
        id: true,
        provider: true,
        keyPrefix: true,
        isActive: true,
        lastUsedAt: true,
        usageCount: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Add providers that don't have keys yet
    const allProviders = Object.values(ApiKeyProvider);
    const existingProviders = apiKeys.map((k) => k.provider);
    const missingProviders = allProviders.filter(
      (p) => !existingProviders.includes(p)
    );

    const result = [
      ...apiKeys.map((k) => ({ ...k, hasKey: true })),
      ...missingProviders.map((provider) => ({
        id: null,
        provider,
        keyPrefix: null,
        isActive: false,
        lastUsedAt: null,
        usageCount: 0,
        createdAt: null,
        updatedAt: null,
        hasKey: false,
      })),
    ].sort((a, b) => a.provider.localeCompare(b.provider));

    return NextResponse.json({ apiKeys: result });
  } catch (error) {
    console.error("[Admin API Keys] GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch API keys" },
      { status: 500 }
    );
  }
}

// POST - Create or update an admin API key
export async function POST(request: NextRequest) {
  const adminAuth = await requireAdmin();
  if ("error" in adminAuth) {
    return NextResponse.json({ error: adminAuth.error }, { status: adminAuth.status });
  }

  try {
    const body = await request.json();
    const { provider, apiKey } = body;

    if (!provider || !apiKey) {
      return NextResponse.json(
        { error: "Provider and apiKey are required" },
        { status: 400 }
      );
    }

    // Validate provider
    if (!Object.values(ApiKeyProvider).includes(provider)) {
      return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
    }

    // Validate API key format
    if (apiKey.length < 10) {
      return NextResponse.json(
        { error: "API key seems too short" },
        { status: 400 }
      );
    }

    const encryptedKey = encryptApiKey(apiKey);
    const keyPrefix = getKeyPrefix(apiKey);

    // Upsert the key
    const result = await prisma.adminApiKey.upsert({
      where: { provider },
      create: {
        provider,
        encryptedKey,
        keyPrefix,
        isActive: true,
        createdBy: adminAuth.user.id,
      },
      update: {
        encryptedKey,
        keyPrefix,
        isActive: true,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        provider: true,
        keyPrefix: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    console.log(`[Admin API Keys] ${provider} key updated by ${adminAuth.user.id}`);

    return NextResponse.json({
      success: true,
      apiKey: result,
    });
  } catch (error) {
    console.error("[Admin API Keys] POST error:", error);
    return NextResponse.json(
      { error: "Failed to save API key" },
      { status: 500 }
    );
  }
}

// DELETE - Remove an admin API key
export async function DELETE(request: NextRequest) {
  const adminAuth = await requireAdmin();
  if ("error" in adminAuth) {
    return NextResponse.json({ error: adminAuth.error }, { status: adminAuth.status });
  }

  try {
    const { searchParams } = new URL(request.url);
    const provider = searchParams.get("provider");

    if (!provider) {
      return NextResponse.json(
        { error: "Provider is required" },
        { status: 400 }
      );
    }

    if (!Object.values(ApiKeyProvider).includes(provider as ApiKeyProvider)) {
      return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
    }

    await prisma.adminApiKey.delete({
      where: { provider: provider as ApiKeyProvider },
    });

    console.log(`[Admin API Keys] ${provider} key deleted by ${adminAuth.user.id}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Admin API Keys] DELETE error:", error);
    return NextResponse.json(
      { error: "Failed to delete API key" },
      { status: 500 }
    );
  }
}

// PATCH - Toggle active status
export async function PATCH(request: NextRequest) {
  const adminAuth = await requireAdmin();
  if ("error" in adminAuth) {
    return NextResponse.json({ error: adminAuth.error }, { status: adminAuth.status });
  }

  try {
    const body = await request.json();
    const { provider, isActive } = body;

    if (!provider || typeof isActive !== "boolean") {
      return NextResponse.json(
        { error: "Provider and isActive are required" },
        { status: 400 }
      );
    }

    const result = await prisma.adminApiKey.update({
      where: { provider },
      data: { isActive },
      select: {
        id: true,
        provider: true,
        isActive: true,
      },
    });

    console.log(
      `[Admin API Keys] ${provider} ${isActive ? "enabled" : "disabled"} by ${adminAuth.user.id}`
    );

    return NextResponse.json({ success: true, apiKey: result });
  } catch (error) {
    console.error("[Admin API Keys] PATCH error:", error);
    return NextResponse.json(
      { error: "Failed to update API key" },
      { status: 500 }
    );
  }
}
