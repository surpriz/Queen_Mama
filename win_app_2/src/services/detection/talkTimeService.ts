import { createLogger } from '@/lib/logger'

const log = createLogger('TalkTime')

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BalanceState = 'noData' | 'balanced' | 'slightImbalance' | 'strongImbalance'

export interface TalkTimeStats {
  /** Total character count attributed to "Moi" (me) */
  meChars: number
  /** Total character count attributed to "Interlocuteur" (other) */
  otherChars: number
  /** Percentage of talk time for "Moi" (0-100) */
  mePercent: number
  /** Percentage of talk time for "Interlocuteur" (0-100) */
  otherPercent: number
  /** Qualitative balance state */
  balance: BalanceState
}

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------

let meChars = 0
let otherChars = 0

// Callback system (same pattern as momentDetectionService)
type StatsCallback = (stats: TalkTimeStats) => void
let statsCallbacks: StatsCallback[] = []

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function computeBalance(mePct: number): BalanceState {
  if (mePct === -1) return 'noData'
  if (mePct >= 40 && mePct <= 60) return 'balanced'
  if (mePct >= 30 && mePct <= 70) return 'slightImbalance'
  return 'strongImbalance'
}

function buildStats(): TalkTimeStats {
  const total = meChars + otherChars

  if (total === 0) {
    return {
      meChars: 0,
      otherChars: 0,
      mePercent: 0,
      otherPercent: 0,
      balance: 'noData',
    }
  }

  const mePercent = Math.round((meChars / total) * 100)
  const otherPercent = 100 - mePercent

  return {
    meChars,
    otherChars,
    mePercent,
    otherPercent,
    balance: computeBalance(mePercent),
  }
}

function notifyListeners(): void {
  const stats = buildStats()
  statsCallbacks.forEach((cb) => cb(stats))
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Update talk time counters from a new transcript chunk.
 *
 * @param speaker - Speaker label (e.g. "Moi", "Interlocuteur", or any other label)
 * @param text    - The transcript text for this chunk
 */
export function updateFromTranscript(speaker: string, text: string): void {
  const charCount = text.trim().length
  if (charCount === 0) return

  const normalized = speaker.toLowerCase().trim()

  if (normalized === 'moi' || normalized === 'me') {
    meChars += charCount
  } else {
    otherChars += charCount
  }

  const stats = buildStats()
  log.debug(
    `Updated: me=${stats.mePercent}% other=${stats.otherPercent}% (${stats.balance})`,
  )

  notifyListeners()
}

/**
 * Return the current talk time statistics.
 */
export function getStats(): TalkTimeStats {
  return buildStats()
}

/**
 * Reset all counters (called on session stop).
 */
export function reset(): void {
  meChars = 0
  otherChars = 0
  log.info('Talk time counters reset')
  notifyListeners()
}

/**
 * Subscribe to stats updates. Returns an unsubscribe function.
 */
export function onStatsUpdated(callback: StatsCallback): () => void {
  statsCallbacks.push(callback)
  return () => {
    statsCallbacks = statsCallbacks.filter((cb) => cb !== callback)
  }
}
