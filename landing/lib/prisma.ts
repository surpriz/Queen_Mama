import { PrismaClient } from "@prisma/client";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL environment variable is not set. " +
    "Please configure it in your .env file or deployment environment."
  );
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// Prisma error codes that indicate a stale/exhausted connection worth reconnecting for.
// P1001 can't reach server, P1002 timed out, P1008 operation timed out,
// P1017 server closed the connection, P2024 timed out fetching from the pool.
const RECONNECT_ERROR_CODES = new Set(["P1001", "P1002", "P1008", "P1017", "P2024"]);

function isConnectionError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  const code = (error as { code?: unknown }).code;
  if (typeof code === "string" && RECONNECT_ERROR_CODES.has(code)) return true;

  // Fallback to message matching for errors that don't carry a Prisma code.
  return (
    error.message.includes("Server has closed the connection") ||
    error.message.includes("connection pool") ||
    error.message.includes("Can't reach database server") ||
    error.message.includes("Connection refused")
  );
}

/**
 * Wrapper for Prisma operations that handles stale connection errors.
 * On Vercel serverless, DB connections can go stale between invocations.
 * This retries the operation once after reconnecting on connection errors.
 */
export async function withRetry<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error: unknown) {
    if (isConnectionError(error)) {
      console.warn("[Prisma] Connection error detected, reconnecting and retrying...");
      await prisma.$disconnect();
      await prisma.$connect();
      return await operation();
    }

    throw error;
  }
}
