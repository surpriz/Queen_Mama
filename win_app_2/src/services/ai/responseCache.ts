/**
 * Response Caching Service
 *
 * Caches AI responses to avoid duplicate API calls for similar transcript context.
 * Ported from mac_app/Services/ResponseCache.swift
 *
 * Key strategy: SHA-256 hash of (mode|responseType|last 500 chars of transcript)
 * TTL: 5 minutes, Max size: 50 entries, LRU eviction
 */

import { createLogger } from '@/lib/logger'

const log = createLogger('ResponseCache')

interface CachedResponse {
  content: string
  timestamp: number
  provider: string
}

const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes
const MAX_CACHE_SIZE = 50
const TRANSCRIPT_SUFFIX_LENGTH = 500

const cache = new Map<string, CachedResponse>()

async function generateCacheKey(
  transcript: string,
  modeId: string | null,
  responseType: string,
): Promise<string> {
  const suffix = transcript.slice(-TRANSCRIPT_SUFFIX_LENGTH)
  const raw = `${modeId ?? 'default'}|${responseType}|${suffix}`

  // Use SubtleCrypto for SHA-256 (available in Electron renderer)
  try {
    const encoder = new TextEncoder()
    const data = encoder.encode(raw)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
  } catch {
    // Fallback: simple string hash
    let hash = 0
    for (let i = 0; i < raw.length; i++) {
      const char = raw.charCodeAt(i)
      hash = ((hash << 5) - hash + char) | 0
    }
    return `fallback-${hash}`
  }
}

export async function getCachedResponse(
  transcript: string,
  modeId: string | null,
  responseType: string,
): Promise<string | null> {
  const key = await generateCacheKey(transcript, modeId, responseType)
  const entry = cache.get(key)

  if (!entry) {
    log.debug('Cache miss')
    return null
  }

  // Check TTL
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    cache.delete(key)
    log.debug('Cache expired, removed')
    return null
  }

  log.info('Cache hit - reusing response')
  return entry.content
}

export async function setCachedResponse(
  transcript: string,
  modeId: string | null,
  responseType: string,
  content: string,
  provider: string = 'auto',
): Promise<void> {
  const key = await generateCacheKey(transcript, modeId, responseType)

  // Evict LRU if at capacity
  if (cache.size >= MAX_CACHE_SIZE && !cache.has(key)) {
    let oldestKey: string | null = null
    let oldestTime = Infinity
    for (const [k, v] of cache) {
      if (v.timestamp < oldestTime) {
        oldestTime = v.timestamp
        oldestKey = k
      }
    }
    if (oldestKey) {
      cache.delete(oldestKey)
      log.debug('Evicted oldest cache entry')
    }
  }

  cache.set(key, {
    content,
    timestamp: Date.now(),
    provider,
  })
}

export function clearCache(): void {
  cache.clear()
  log.info('Cache cleared')
}

export function getCacheStats(): { size: number; maxSize: number } {
  return { size: cache.size, maxSize: MAX_CACHE_SIZE }
}
