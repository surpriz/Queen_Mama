/**
 * Token Usage Tracker
 *
 * Tracks token usage across AI requests for cost awareness.
 * Ported from mac_app/Services/TokenUsageTracker.swift
 *
 * Pricing based on Claude Sonnet 4.5:
 *   Input:  $3.00 / 1M tokens
 *   Output: $15.00 / 1M tokens
 *   Cached: $0.30 / 1M tokens (90% discount)
 */

import { createLogger } from '@/lib/logger'

const log = createLogger('TokenUsageTracker')

// ── Pricing constants ────────────────────────────────────────────────
const INPUT_COST_PER_TOKEN = 0.000003 // $3 / 1M
const OUTPUT_COST_PER_TOKEN = 0.000015 // $15 / 1M
const CACHED_COST_PER_TOKEN = 0.0000003 // $0.30 / 1M

// ── Session-level accumulators ───────────────────────────────────────
let sessionInputTokens = 0
let sessionOutputTokens = 0
let sessionCachedTokens = 0
let sessionRequestCount = 0

// ── Lifetime accumulators ────────────────────────────────────────────
let lifetimeInputTokens = 0
let lifetimeOutputTokens = 0
let lifetimeCachedTokens = 0
let lifetimeRequests = 0
let lifetimeCostUSD = 0

const LIFETIME_KEY = 'qm_lifetime_token_usage'

// ── Helpers ──────────────────────────────────────────────────────────

function estimateCost(input: number, output: number, cached: number): number {
  const uncachedInput = Math.max(input - cached, 0)
  return (
    uncachedInput * INPUT_COST_PER_TOKEN +
    cached * CACHED_COST_PER_TOKEN +
    output * OUTPUT_COST_PER_TOKEN
  )
}

function loadLifetime(): void {
  try {
    const raw = localStorage.getItem(LIFETIME_KEY)
    if (raw) {
      const data = JSON.parse(raw)
      lifetimeInputTokens = data.totalInputTokens ?? 0
      lifetimeOutputTokens = data.totalOutputTokens ?? 0
      lifetimeCachedTokens = data.totalCachedTokens ?? 0
      lifetimeRequests = data.totalRequests ?? 0
      lifetimeCostUSD = data.totalCostUSD ?? 0
    }
  } catch {
    log.warn('Failed to load lifetime token usage')
  }
}

function saveLifetime(): void {
  try {
    localStorage.setItem(
      LIFETIME_KEY,
      JSON.stringify({
        totalInputTokens: lifetimeInputTokens,
        totalOutputTokens: lifetimeOutputTokens,
        totalCachedTokens: lifetimeCachedTokens,
        totalRequests: lifetimeRequests,
        totalCostUSD: lifetimeCostUSD,
      }),
    )
  } catch {
    log.warn('Failed to persist lifetime token usage')
  }
}

// Initialise lifetime stats on module load
loadLifetime()

// ── Public API ───────────────────────────────────────────────────────

/**
 * Record token usage from an AI response.
 * If the proxy doesn't return exact counts, callers should estimate
 * using ~1 token per 4 characters.
 */
export function recordUsage(input: number, output: number, cached: number = 0): void {
  sessionInputTokens += input
  sessionOutputTokens += output
  sessionCachedTokens += cached
  sessionRequestCount += 1

  const requestCost = estimateCost(input, output, cached)

  // Lifetime
  lifetimeInputTokens += input
  lifetimeOutputTokens += output
  lifetimeCachedTokens += cached
  lifetimeRequests += 1
  lifetimeCostUSD += requestCost

  saveLifetime()

  log.info(
    `Request #${sessionRequestCount}: in=${input} out=${output} cached=${cached} cost=$${requestCost.toFixed(4)}`,
  )
}

/** Estimated cost for the current session in USD. */
export function getSessionCost(): number {
  return estimateCost(sessionInputTokens, sessionOutputTokens, sessionCachedTokens)
}

/** Estimated cost across all sessions in USD. */
export function getTotalCost(): number {
  return lifetimeCostUSD
}

/** Reset session-level accumulators (call when starting a new session). */
export function resetSession(): void {
  sessionInputTokens = 0
  sessionOutputTokens = 0
  sessionCachedTokens = 0
  sessionRequestCount = 0
  log.info('Session usage reset')
}

/** Get a snapshot of the current session usage. */
export function getSessionStats() {
  return {
    inputTokens: sessionInputTokens,
    outputTokens: sessionOutputTokens,
    cachedTokens: sessionCachedTokens,
    requestCount: sessionRequestCount,
    costUSD: getSessionCost(),
    formattedCost: `$${getSessionCost().toFixed(4)}`,
  }
}

/** Get a snapshot of lifetime usage. */
export function getLifetimeStats() {
  return {
    totalInputTokens: lifetimeInputTokens,
    totalOutputTokens: lifetimeOutputTokens,
    totalCachedTokens: lifetimeCachedTokens,
    totalRequests: lifetimeRequests,
    totalCostUSD: lifetimeCostUSD,
    formattedCost: `$${lifetimeCostUSD.toFixed(2)}`,
  }
}

/** Rough token count from character length (1 token ~ 4 chars). */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}
