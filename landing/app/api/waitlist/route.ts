import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const waitlistSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  platform: z.enum(["WINDOWS", "LINUX", "IOS", "ANDROID"]),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = waitlistSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 400 }
      );
    }

    const { email, platform } = result.data;

    // Check if email already exists for this platform
    const existing = await prisma.waitlist.findFirst({
      where: { email, platform },
    });

    if (existing) {
      return NextResponse.json(
        { message: "You're already on the waitlist!" },
        { status: 200 }
      );
    }

    await prisma.waitlist.create({
      data: { email, platform },
    });

    return NextResponse.json(
      { message: "You've been added to the waitlist!" },
      { status: 201 }
    );
  } catch (error) {
    console.error("Waitlist error:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
