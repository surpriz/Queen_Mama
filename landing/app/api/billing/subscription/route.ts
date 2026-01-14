import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let subscription = await prisma.subscription.findUnique({
    where: { userId: session.user.id },
  });

  if (!subscription) {
    subscription = await prisma.subscription.create({
      data: {
        userId: session.user.id,
        plan: "FREE",
        status: "ACTIVE",
      },
    });
  }

  return NextResponse.json(subscription);
}
