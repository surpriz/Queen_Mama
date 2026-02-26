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

/**
 * Wrapper for Prisma operations that handles stale connection errors.
 * On Vercel serverless, DB connections can go stale between invocations.
 * This retries the operation once after reconnecting on connection errors.
 */
export async function withRetry<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error: unknown) {
    const isConnectionError =
      error instanceof Error &&
      (error.message.includes("Server has closed the connection") ||
        error.message.includes("Connection pool timeout") ||
        error.message.includes("Can't reach database server") ||
        error.message.includes("Connection refused"));

    if (isConnectionError) {
      console.warn("[Prisma] Connection error detected, reconnecting and retrying...");
      await prisma.$disconnect();
      await prisma.$connect();
      return await operation();
    }

    throw error;
  }
}
