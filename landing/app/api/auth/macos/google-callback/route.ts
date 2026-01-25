import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  signAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  AUTH_CONSTANTS,
} from "@/lib/device-auth";
import { macosGoogleCallbackSchema } from "@/lib/validations";

interface GoogleTokenResponse {
  access_token: string;
  id_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
  refresh_token?: string;
}

interface GoogleUserInfo {
  sub: string; // Google user ID
  email: string;
  email_verified: boolean;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
}

/**
 * POST /api/auth/macos/google-callback
 * Exchange Google OAuth authorization code for tokens (PKCE flow)
 * Handles both new user creation and existing user login
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = macosGoogleCallbackSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "invalid_request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const {
      authorizationCode,
      codeVerifier,
      redirectUri,
      deviceId,
      deviceName,
      platform,
      osVersion,
      appVersion,
    } = parsed.data;

    // Exchange authorization code for tokens with Google
    const tokenResponse = await exchangeCodeForTokens(
      authorizationCode,
      codeVerifier,
      redirectUri
    );

    if (!tokenResponse) {
      console.error("Token exchange failed for redirectUri:", redirectUri);
      return NextResponse.json(
        { error: "google_auth_failed", message: "Failed to exchange authorization code. Check server logs." },
        { status: 400 }
      );
    }

    // Get user info from Google
    const googleUser = await getGoogleUserInfo(tokenResponse.access_token);

    if (!googleUser || !googleUser.email) {
      return NextResponse.json(
        { error: "google_user_info_failed", message: "Failed to get user information from Google" },
        { status: 400 }
      );
    }

    const normalizedEmail = googleUser.email.toLowerCase();

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        email: true,
        name: true,
        password: true,
        role: true,
        accounts: {
          where: { provider: "google" },
          select: { id: true, providerAccountId: true },
        },
      },
    });

    let user: { id: string; email: string; name: string | null; role: string };
    let isNewUser = false;

    if (existingUser) {
      // User exists - check if they have Google account linked
      if (existingUser.accounts.length > 0) {
        // User has Google linked - proceed with login
        user = {
          id: existingUser.id,
          email: existingUser.email,
          name: existingUser.name,
          role: existingUser.role,
        };
      } else if (existingUser.password) {
        // User has password account, no Google linked
        // Return error - they should use email/password login
        return NextResponse.json(
          {
            error: "credentials_account_exists",
            authMethod: "credentials",
            message: "This email uses password login. Please sign in with your email and password.",
          },
          { status: 400 }
        );
      } else {
        // User exists but no password and no Google - might have GitHub
        // Link Google account to existing user
        await prisma.account.create({
          data: {
            userId: existingUser.id,
            type: "oauth",
            provider: "google",
            providerAccountId: googleUser.sub,
            access_token: tokenResponse.access_token,
            id_token: tokenResponse.id_token,
            expires_at: Math.floor(Date.now() / 1000) + tokenResponse.expires_in,
            token_type: tokenResponse.token_type,
            scope: tokenResponse.scope,
          },
        });

        user = {
          id: existingUser.id,
          email: existingUser.email,
          name: existingUser.name,
          role: existingUser.role,
        };
      }

      // Check if blocked
      if (user.role === "BLOCKED") {
        return NextResponse.json(
          { error: "account_blocked", message: "Your account has been blocked" },
          { status: 403 }
        );
      }
    } else {
      // New user - create account
      isNewUser = true;

      const newUser = await prisma.$transaction(async (tx) => {
        // Create user with subscription and Google account
        const createdUser = await tx.user.create({
          data: {
            name: googleUser.name || googleUser.given_name || null,
            email: normalizedEmail,
            emailVerified: googleUser.email_verified ? new Date() : null,
            image: googleUser.picture || null,
            subscription: {
              create: {
                plan: "FREE",
                status: "ACTIVE",
              },
            },
            accounts: {
              create: {
                type: "oauth",
                provider: "google",
                providerAccountId: googleUser.sub,
                access_token: tokenResponse.access_token,
                id_token: tokenResponse.id_token,
                expires_at: Math.floor(Date.now() / 1000) + tokenResponse.expires_in,
                token_type: tokenResponse.token_type,
                scope: tokenResponse.scope,
              },
            },
          },
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
          },
        });

        return createdUser;
      });

      user = newUser;
    }

    // Handle device registration and token generation
    const result = await prisma.$transaction(async (tx) => {
      // Check device limit
      const activeDevices = await tx.device.count({
        where: {
          userId: user.id,
          isActive: true,
        },
      });

      // Find or create device
      let device = await tx.device.findUnique({
        where: { deviceId },
      });

      if (!device) {
        if (activeDevices >= AUTH_CONSTANTS.MAX_DEVICES_PER_USER) {
          throw new Error("device_limit");
        }

        device = await tx.device.create({
          data: {
            userId: user.id,
            deviceId,
            name: deviceName,
            platform,
            osVersion,
            appVersion,
          },
        });
      } else {
        // Update existing device
        await tx.device.update({
          where: { id: device.id },
          data: {
            userId: user.id,
            name: deviceName,
            osVersion,
            appVersion,
            lastSeenAt: new Date(),
            isActive: true,
          },
        });
      }

      // Revoke any existing refresh tokens for this device
      await tx.refreshToken.updateMany({
        where: {
          deviceId: device.id,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      });

      // Generate tokens
      const accessToken = await signAccessToken({
        userId: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        deviceId,
      });

      const refreshToken = generateRefreshToken();
      const refreshTokenHash = hashRefreshToken(refreshToken);

      // Store refresh token
      await tx.refreshToken.create({
        data: {
          tokenHash: refreshTokenHash,
          userId: user.id,
          deviceId: device.id,
          expiresAt: new Date(
            Date.now() + AUTH_CONSTANTS.REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000
          ),
        },
      });

      return { accessToken, refreshToken };
    });

    return NextResponse.json(
      {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        expiresIn: AUTH_CONSTANTS.ACCESS_TOKEN_EXPIRY_SECONDS,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
        isNewUser,
      },
      { status: isNewUser ? 201 : 200 }
    );
  } catch (error) {
    console.error("Google callback error:", error);

    // Handle device limit error
    if (error instanceof Error && error.message === "device_limit") {
      return NextResponse.json(
        {
          error: "device_limit",
          message: "Maximum device limit reached. Please remove a device first.",
          maxDevices: AUTH_CONSTANTS.MAX_DEVICES_PER_USER,
        },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: "server_error", message: "Authentication failed" },
      { status: 500 }
    );
  }
}

/**
 * Exchange authorization code for tokens using Google's token endpoint
 * Supports both web clients (with secret) and iOS clients (PKCE only, no secret)
 */
async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string,
  redirectUri: string
): Promise<GoogleTokenResponse | null> {
  try {
    // Check which client ID is being used based on redirect URI
    const isIOSClient = redirectUri.startsWith("com.googleusercontent.apps.");

    const clientId = isIOSClient
      ? process.env.AUTH_GOOGLE_IOS_CLIENT_ID
      : process.env.AUTH_GOOGLE_ID;
    const clientSecret = process.env.AUTH_GOOGLE_SECRET;

    if (!clientId) {
      console.error("Google OAuth client ID not configured");
      return null;
    }

    // Build request body - iOS clients with PKCE don't need client_secret
    const params: Record<string, string> = {
      code,
      client_id: clientId,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
      code_verifier: codeVerifier,
    };

    // Only add client_secret for web clients
    if (!isIOSClient && clientSecret) {
      params.client_secret = clientSecret;
    }

    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(params),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("Google token exchange failed:", {
        status: response.status,
        error: errorData,
        clientId: clientId?.substring(0, 20) + "...",
        redirectUri,
        isIOSClient,
      });
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error("Error exchanging code for tokens:", error);
    return null;
  }
}

/**
 * Get user information from Google using access token
 */
async function getGoogleUserInfo(accessToken: string): Promise<GoogleUserInfo | null> {
  try {
    const response = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("Google user info failed:", errorData);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error("Error getting Google user info:", error);
    return null;
  }
}
