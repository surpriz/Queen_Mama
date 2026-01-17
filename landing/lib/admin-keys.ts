import { prisma } from "@/lib/prisma";
import { decryptApiKey } from "@/lib/encryption";
import { ApiKeyProvider } from "@prisma/client";

// Cache for admin API keys (5 minutes TTL)
const keyCache = new Map<
  ApiKeyProvider,
  { key: string; expiresAt: number }
>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get an admin API key for a specific provider
 * Returns null if no key is configured or if the key is disabled
 */
export async function getAdminApiKey(
  provider: ApiKeyProvider
): Promise<string | null> {
  // Check cache first
  const cached = keyCache.get(provider);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.key;
  }

  try {
    const adminKey = await prisma.adminApiKey.findUnique({
      where: { provider },
      select: {
        encryptedKey: true,
        isActive: true,
      },
    });

    if (!adminKey || !adminKey.isActive) {
      // Clear cache if key was disabled
      keyCache.delete(provider);
      return null;
    }

    const decryptedKey = decryptApiKey(adminKey.encryptedKey);

    // Cache the key
    keyCache.set(provider, {
      key: decryptedKey,
      expiresAt: Date.now() + CACHE_TTL,
    });

    return decryptedKey;
  } catch (error) {
    console.error(`[AdminKeys] Error fetching ${provider} key:`, error);
    return null;
  }
}

/**
 * Get all active admin API keys
 */
export async function getAllActiveAdminKeys(): Promise<
  Map<ApiKeyProvider, string>
> {
  const keys = new Map<ApiKeyProvider, string>();

  try {
    const adminKeys = await prisma.adminApiKey.findMany({
      where: { isActive: true },
      select: {
        provider: true,
        encryptedKey: true,
      },
    });

    for (const adminKey of adminKeys) {
      const decryptedKey = decryptApiKey(adminKey.encryptedKey);
      keys.set(adminKey.provider, decryptedKey);

      // Update cache
      keyCache.set(adminKey.provider, {
        key: decryptedKey,
        expiresAt: Date.now() + CACHE_TTL,
      });
    }
  } catch (error) {
    console.error("[AdminKeys] Error fetching all keys:", error);
  }

  return keys;
}

/**
 * Check which providers have active admin keys configured
 */
export async function getConfiguredProviders(): Promise<ApiKeyProvider[]> {
  try {
    const adminKeys = await prisma.adminApiKey.findMany({
      where: { isActive: true },
      select: { provider: true },
    });

    return adminKeys.map((k) => k.provider);
  } catch (error) {
    console.error("[AdminKeys] Error checking configured providers:", error);
    return [];
  }
}

/**
 * Record usage of an admin API key
 */
export async function recordAdminKeyUsage(
  provider: ApiKeyProvider
): Promise<void> {
  try {
    await prisma.adminApiKey.update({
      where: { provider },
      data: {
        lastUsedAt: new Date(),
        usageCount: { increment: 1 },
      },
    });
  } catch (error) {
    // Non-critical, just log
    console.error(`[AdminKeys] Error recording usage for ${provider}:`, error);
  }
}

/**
 * Clear the key cache (useful after updates)
 */
export function clearKeyCache(): void {
  keyCache.clear();
}

/**
 * Map provider string to ApiKeyProvider enum
 */
export function toApiKeyProvider(provider: string): ApiKeyProvider | null {
  const normalized = provider.toUpperCase();
  if (Object.values(ApiKeyProvider).includes(normalized as ApiKeyProvider)) {
    return normalized as ApiKeyProvider;
  }
  return null;
}
