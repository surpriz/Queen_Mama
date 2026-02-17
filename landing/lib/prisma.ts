import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const client = new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

  // Handle Neon serverless connection drops gracefully
  client.$use(async (params, next) => {
    const MAX_RETRIES = 2;
    let retries = 0;
    while (true) {
      try {
        return await next(params);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        if (
          retries < MAX_RETRIES &&
          (message.includes("Connection closed") ||
            message.includes("kind: Closed") ||
            message.includes("Can't reach database server"))
        ) {
          retries++;
          console.warn(
            `[Prisma] Connection lost, retrying (${retries}/${MAX_RETRIES})...`
          );
          await new Promise((r) => setTimeout(r, 1000 * retries));
          continue;
        }
        throw error;
      }
    }
  });

  return client;
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
