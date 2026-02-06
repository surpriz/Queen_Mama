import { auth } from "@/lib/auth";
import { prisma, withRetry } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Use upsert to avoid race condition when two concurrent requests
  // both find no subscription and try to create one (foreign key constraint violation)
  const subscription = await withRetry(() =>
    prisma.subscription.upsert({
      where: { userId: session.user.id },
      update: {},
      create: {
        userId: session.user.id,
        plan: "FREE",
        status: "ACTIVE",
      },
    })
  );

  return NextResponse.json(subscription);
}
