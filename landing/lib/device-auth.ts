import crypto from "crypto";
import { SignJWT, jwtVerify, type JWTPayload } from "jose";

// ===========================================
// CODE GENERATION
// ===========================================

const USER_CODE_LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // Exclude I, O to avoid confusion
const USER_CODE_DIGITS = "123456789"; // Exclude 0 to avoid confusion

/**
 * Generates a user-friendly device code like "ABCD-1234"
 */
export function generateUserCode(): string {
  let letters = "";
  let digits = "";

  for (let i = 0; i < 4; i++) {
    letters += USER_CODE_LETTERS[crypto.randomInt(USER_CODE_LETTERS.length)];
    digits += USER_CODE_DIGITS[crypto.randomInt(USER_CODE_DIGITS.length)];
  }

  return `${letters}-${digits}`;
}

/**
 * Generates a device code UUID for polling
 */
export function generateDeviceCode(): string {
  return crypto.randomUUID();
}

/**
 * Generates a secure random refresh token
 */
export function generateRefreshToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

// ===========================================
// TOKEN HASHING
// ===========================================

/**
 * Hashes a refresh token for secure storage
 */
export function hashRefreshToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Verifies a refresh token against its hash
 */
export function verifyRefreshToken(token: string, hash: string): boolean {
  const tokenHash = hashRefreshToken(token);
  return crypto.timingSafeEqual(Buffer.from(tokenHash), Buffer.from(hash));
}

// ===========================================
// JWT TOKENS
// ===========================================

interface AccessTokenPayload extends JWTPayload {
  sub: string; // userId
  email: string;
  name: string | null;
  role: string;
  deviceId: string;
}

interface LicensePayload extends JWTPayload {
  sub: string;
  plan: string;
  features: Record<string, unknown>;
}

function getJWTSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET environment variable is not set");
  }
  return new TextEncoder().encode(secret);
}

/**
 * Creates a short-lived access token (15 minutes)
 */
export async function signAccessToken(payload: {
  userId: string;
  email: string;
  name: string | null;
  role: string;
  deviceId: string;
}): Promise<string> {
  const secret = getJWTSecret();

  return new SignJWT({
    sub: payload.userId,
    email: payload.email,
    name: payload.name,
    role: payload.role,
    deviceId: payload.deviceId,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("15m")
    .setIssuer("queenmama")
    .setAudience("queenmama-macos")
    .sign(secret);
}

/**
 * Verifies an access token and returns its payload
 */
export async function verifyAccessToken(
  token: string
): Promise<AccessTokenPayload> {
  const secret = getJWTSecret();

  const { payload } = await jwtVerify(token, secret, {
    issuer: "queenmama",
    audience: "queenmama-macos",
  });

  return payload as AccessTokenPayload;
}

// ===========================================
// LICENSE SIGNING
// ===========================================

function getLicenseSecret(): string {
  const secret = process.env.LICENSE_SECRET;
  if (!secret) {
    throw new Error("LICENSE_SECRET environment variable is not set");
  }
  return secret;
}

/**
 * Signs a license response with HMAC for integrity verification
 */
export function signLicenseResponse(
  data: Record<string, unknown>
): string {
  const secret = getLicenseSecret();
  const payload = JSON.stringify(data);

  return crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");
}

/**
 * Verifies a license response signature
 */
export function verifyLicenseSignature(
  data: Record<string, unknown>,
  signature: string
): boolean {
  const expectedSignature = signLicenseResponse(data);
  return crypto.timingSafeEqual(
    Buffer.from(expectedSignature),
    Buffer.from(signature)
  );
}

// ===========================================
// DEVICE ID VALIDATION
// ===========================================

/**
 * Validates a device ID format (should be a UUID or similar)
 */
export function isValidDeviceId(deviceId: string): boolean {
  // Accept UUIDs and Apple device identifiers
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const appleIdRegex = /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/;

  return uuidRegex.test(deviceId) || appleIdRegex.test(deviceId);
}

// ===========================================
// CONSTANTS
// ===========================================

export const AUTH_CONSTANTS = {
  ACCESS_TOKEN_EXPIRY_SECONDS: 15 * 60, // 15 minutes
  REFRESH_TOKEN_EXPIRY_DAYS: 30,
  DEVICE_CODE_EXPIRY_MINUTES: 15,
  LICENSE_CACHE_TTL_SECONDS: 86400, // 24 hours
  MAX_DEVICES_PER_USER: 5,
} as const;
