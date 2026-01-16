import { prisma } from "@/lib/prisma";

/**
 * Log an admin action to the UsageLog table
 * @param adminId - The ID of the admin performing the action
 * @param action - The action being performed (will be prefixed with ADMIN_)
 * @param metadata - Additional metadata about the action
 */
export async function logAdminAction(
  adminId: string,
  action: string,
  metadata?: Record<string, any>
) {
  try {
    await prisma.usageLog.create({
      data: {
        userId: adminId,
        action: `ADMIN_${action}`,
        metadata: {
          ...metadata,
          timestamp: new Date().toISOString(),
        },
      },
    });
  } catch (error) {
    // Log the error but don't throw - audit logging failure shouldn't break operations
    console.error("Failed to log admin action:", error);
  }
}
