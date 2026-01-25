import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkEmailSchema } from "@/lib/validations";

// Simple in-memory rate limiter (in production, use Redis)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 5; // requests per minute
const RATE_WINDOW = 60 * 1000; // 1 minute

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW });
    return false;
  }

  if (entry.count >= RATE_LIMIT) {
    return true;
  }

  entry.count++;
  return false;
}

// Normalize response time to prevent timing attacks
async function normalizedDelay(startTime: number, targetMs: number = 200): Promise<void> {
  const elapsed = Date.now() - startTime;
  const remaining = targetMs - elapsed;
  if (remaining > 0) {
    await new Promise((resolve) => setTimeout(resolve, remaining));
  }
}

/**
 * POST /api/auth/check-email
 * Check if an email exists and what authentication method it uses
 *
 * Response:
 * - exists: boolean - whether the email is registered
 * - authMethod: "credentials" | "google" | null - the auth method used
 */
export async function POST(request: Request) {
  const startTime = Date.now();

  try {
    // Rate limiting
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0] ||
               request.headers.get("x-real-ip") ||
               "unknown";

    if (isRateLimited(ip)) {
      await normalizedDelay(startTime);
      return NextResponse.json(
        { error: "rate_limited", message: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const parsed = checkEmailSchema.safeParse(body);

    if (!parsed.success) {
      await normalizedDelay(startTime);
      return NextResponse.json(
        { error: "invalid_request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { email } = parsed.data;
    const normalizedEmail = email.toLowerCase();

    // Find user and their accounts
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        password: true,
        accounts: {
          select: {
            provider: true,
          },
        },
      },
    });

    // Normalize response time to prevent timing attacks
    await normalizedDelay(startTime);

    if (!user) {
      return NextResponse.json({
        exists: false,
        authMethod: null,
      });
    }

    // Determine auth method
    let authMethod: "credentials" | "google" | null = null;

    // Check if user has Google account linked
    const hasGoogle = user.accounts.some((acc) => acc.provider === "google");

    if (hasGoogle) {
      authMethod = "google";
    } else if (user.password) {
      authMethod = "credentials";
    }

    return NextResponse.json({
      exists: true,
      authMethod,
    });
  } catch (error) {
    console.error("Check email error:", error);
    await normalizedDelay(startTime);
    return NextResponse.json(
      { error: "server_error", message: "Failed to check email" },
      { status: 500 }
    );
  }
}
