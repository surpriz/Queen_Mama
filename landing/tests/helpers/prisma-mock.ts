import { vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { mockDeep, mockReset, type DeepMockProxy } from "vitest-mock-extended";

// Create a deep mock of PrismaClient
export const prismaMock = mockDeep<PrismaClient>();

// Mock the prisma module
vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
  withRetry: vi.fn((fn: () => Promise<unknown>) => fn()),
}));

// Reset mock between tests
export function resetPrismaMock() {
  mockReset(prismaMock);
}

export type MockPrismaClient = DeepMockProxy<PrismaClient>;
