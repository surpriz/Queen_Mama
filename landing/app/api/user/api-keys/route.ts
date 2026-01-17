import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { apiKeySchema } from "@/lib/validations";
import { encryptApiKey, getKeyPrefix } from "@/lib/encryption";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKeys = await prisma.apiKey.findMany({
    where: { userId: session.user.id },
    select: {
      id: true,
      provider: true,
      keyPrefix: true,
      isActive: true,
      createdAt: true,
      lastUsedAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(apiKeys);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = apiKeySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { provider, apiKey } = parsed.data;

    const existing = await prisma.apiKey.findUnique({
      where: {
        userId_provider: {
          userId: session.user.id,
          provider,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "An API key for this provider already exists" },
        { status: 400 }
      );
    }

    const encryptedKey = encryptApiKey(apiKey);
    const keyPrefix = getKeyPrefix(apiKey);

    const newApiKey = await prisma.apiKey.create({
      data: {
        userId: session.user.id,
        name: provider,
        provider,
        keyHash: encryptedKey,
        keyPrefix,
      },
      select: {
        id: true,
        provider: true,
        keyPrefix: true,
        isActive: true,
        createdAt: true,
      },
    });

    return NextResponse.json(newApiKey, { status: 201 });
  } catch (error) {
    console.error("Create API key error:", error);
    return NextResponse.json(
      { error: "Failed to create API key" },
      { status: 500 }
    );
  }
}
