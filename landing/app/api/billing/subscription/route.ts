import { auth } from "@/lib/auth";
import { prisma, withRetry } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify the user still exists in DB before upserting subscription.
  // The NextAuth JWT can outlive a deleted User record, causing a FK
  // constraint violation on Subscription_userId_fkey (Sentry: QUEENMAMA_LANDING-G/H).
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 401 });
  }

  // Use upsert to avoid race condition when two concurrent requests
  // both find no subscription and try to create one
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
