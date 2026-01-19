import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const checks: Record<string, string> = {
    status: "ok",
    timestamp: new Date().toISOString(),
  };

  // Check environment variables
  checks.DATABASE_URL = process.env.DATABASE_URL ? "set" : "MISSING";
  checks.AUTH_SECRET = process.env.AUTH_SECRET ? "set" : "MISSING";
  checks.NEXTAUTH_URL = process.env.NEXTAUTH_URL || "MISSING";

  // Test database connection
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = "connected";
  } catch (error) {
    checks.database = `error: ${error instanceof Error ? error.message : "unknown"}`;
    checks.status = "error";
  }

  // Count users to verify table exists
  try {
    const userCount = await prisma.user.count();
    checks.users = `${userCount} users`;
  } catch (error) {
    checks.users = `error: ${error instanceof Error ? error.message : "unknown"}`;
  }

  return NextResponse.json(checks, {
    status: checks.status === "ok" ? 200 : 500,
  });
}
