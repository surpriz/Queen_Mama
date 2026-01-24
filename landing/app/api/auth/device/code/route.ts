import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  generateUserCode,
  generateDeviceCode,
  AUTH_CONSTANTS,
} from "@/lib/device-auth";
import { deviceCodeRequestSchema } from "@/lib/validations";

// CORS headers for desktop app requests
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

/**
 * OPTIONS /api/auth/device/code
 * Handle preflight CORS requests
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

/**
 * POST /api/auth/device/code
 * Generates a device code pair for OAuth device flow authorization
 * Called by macOS app to start the device code flow
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = deviceCodeRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400, headers: corsHeaders }
      );
    }

    const { deviceId, deviceName, platform } = parsed.data;

    // Clean up any existing codes for this device
    await prisma.deviceAuthCode.deleteMany({
      where: { deviceId },
    });

    // Generate new codes
    const userCode = generateUserCode();
    const deviceCode = generateDeviceCode();
    const expiresAt = new Date(
      Date.now() + AUTH_CONSTANTS.DEVICE_CODE_EXPIRY_MINUTES * 60 * 1000
    );

    // Store the code pair
    await prisma.deviceAuthCode.create({
      data: {
        userCode,
        deviceCode,
        deviceId,
        deviceName,
        platform,
        expiresAt,
      },
    });

    return NextResponse.json(
      {
        userCode, // Display to user: "ABCD-1234"
        deviceCode, // Use for polling
        expiresIn: AUTH_CONSTANTS.DEVICE_CODE_EXPIRY_MINUTES * 60,
        interval: 5, // Polling interval in seconds
        verificationUrl: `${process.env.NEXTAUTH_URL || "https://queenmama.app"}/auth/device`,
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error("Device code generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate device code" },
      { status: 500, headers: corsHeaders }
    );
  }
}
