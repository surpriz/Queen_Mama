import type { License } from '@/types/auth'

/**
 * HMAC-SHA256 license signature verification (mac `LicenseManager.swift` parity).
 *
 * The backend signs `JSON.stringify({ valid, plan, status, features, trial, cacheTTL, validatedAt })`
 * with LICENSE_SECRET. The secret is only read from the build environment
 * (`VITE_LICENSE_SECRET`); when it is absent verification is skipped and the
 * server response is trusted, exactly like macOS.
 */

export type SignatureCheck = 'valid' | 'invalid' | 'skipped'

/** Rebuild the exact payload the server signed (key order matters). */
export function buildSignaturePayload(license: License): string {
  return JSON.stringify({
    valid: license.valid,
    plan: license.plan,
    status: license.status,
    features: license.features,
    trial: license.trial ?? null,
    cacheTTL: license.cacheTTL,
    validatedAt: license.validatedAt,
  })
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/** Constant-time comparison so a tampered signature can't be timed. */
export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return result === 0
}

export async function computeLicenseSignature(
  license: License,
  secret: string,
  subtle: SubtleCrypto | undefined = globalThis.crypto?.subtle,
): Promise<string> {
  if (!subtle) throw new Error('WebCrypto unavailable')
  const encoder = new TextEncoder()
  const key = await subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const mac = await subtle.sign('HMAC', key, encoder.encode(buildSignaturePayload(license)))
  return toHex(mac)
}

/**
 * Verify a license. Returns 'skipped' when there is nothing to verify (no
 * secret configured, or an unsigned local FREE license).
 */
export async function verifyLicenseSignature(
  license: License,
  secret: string | undefined | null,
  subtle?: SubtleCrypto,
): Promise<SignatureCheck> {
  if (!license.signature && license.plan === 'FREE') return 'skipped'
  if (!secret) return 'skipped'
  if (!license.signature) return 'invalid'
  try {
    const expected = await computeLicenseSignature(license, secret, subtle)
    return constantTimeEqual(expected, license.signature.toLowerCase()) ? 'valid' : 'invalid'
  } catch {
    return 'skipped'
  }
}

/** Build-time secret, never a bundled fallback (mac: env only). */
export function getLicenseSecret(): string | null {
  const value = import.meta.env?.VITE_LICENSE_SECRET
  return typeof value === 'string' && value.length > 0 ? value : null
}
