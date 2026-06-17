import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AUTH_CONSTANTS } from "@/lib/device-auth";

/**
 * GET /api/cron/device-cleanup
 *
 * Vercel Cron Job endpoint that deactivates devices that haven't been seen
 * for longer than AUTH_CONSTANTS.DEVICE_INACTIVE_TTL_DAYS. Deactivated devices
 * stop counting against the per-plan limit and their refresh tokens are revoked,
 * so stale devices free up slots automatically instead of locking users out.
 *
 * Devices are deactivated (isActive=false), not deleted, so they remain visible
 * in the dashboard and can be removed manually.
 *
 * Protected by CRON_SECRET environment variable.
 */
export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    console.error("[DeviceCleanup] Invalid or missing CRON_SECRET");
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const startTime = Date.now();
  const cutoff = new Date(
    Date.now() - AUTH_CONSTANTS.DEVICE_INACTIVE_TTL_DAYS * 24 * 60 * 60 * 1000
  );

  console.log(
    `[DeviceCleanup] Deactivating devices not seen since ${cutoff.toISOString()}`
  );

  try {
    // Find stale active devices first so we can revoke their tokens.
    const staleDevices = await prisma.device.findMany({
      where: {
        isActive: true,
        lastSeenAt: { lt: cutoff },
      },
      select: { id: true },
    });

    if (staleDevices.length === 0) {
      const duration = Date.now() - startTime;
      console.log("[DeviceCleanup] No stale devices found");
      return NextResponse.json({
        success: true,
        duration,
        cutoff: cutoff.toISOString(),
        devicesDeactivated: 0,
        tokensRevoked: 0,
      });
    }

    const deviceIds = staleDevices.map((d) => d.id);

    const [tokensResult, devicesResult] = await prisma.$transaction([
      prisma.refreshToken.updateMany({
        where: { deviceId: { in: deviceIds }, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
      prisma.device.updateMany({
        where: { id: { in: deviceIds } },
        data: { isActive: false },
      }),
    ]);

    const duration = Date.now() - startTime;
    console.log(
      `[DeviceCleanup] Deactivated ${devicesResult.count} devices, revoked ${tokensResult.count} tokens in ${duration}ms`
    );

    return NextResponse.json({
      success: true,
      duration,
      cutoff: cutoff.toISOString(),
      devicesDeactivated: devicesResult.count,
      tokensRevoked: tokensResult.count,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error("[DeviceCleanup] Job failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        duration,
      },
      { status: 500 }
    );
  }
}

export const maxDuration = 60; // seconds
