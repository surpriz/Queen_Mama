import { auth } from "@/lib/auth";
import { UserRole } from "@prisma/client";

/**
 * Require admin role for the current user
 * Throws error if not authenticated or not admin
 * @returns The authenticated admin user
 */
export async function requireAdmin() {
  const session = await auth();

  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  if (session.user.role !== "ADMIN") {
    throw new Error("Forbidden");
  }

  return session.user;
}

/**
 * Check if a user role is admin
 * @param role - The user role to check
 * @returns true if the role is ADMIN
 */
export function isAdmin(role?: UserRole): boolean {
  return role === "ADMIN";
}
