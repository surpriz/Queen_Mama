/**
 * TranscriptDeduplicator - Filters microphone "bleed"
 *
 * When the mic picks up remote participants' audio from the speakers,
 * the same speech gets transcribed on both streams. This service detects
 * and filters the duplicate mic transcripts.
 *
 * Three-layer strategy (aligned with macOS TranscriptDeduplicator.swift):
 * 1. Temporal suppression: if system audio produced a transcript within 1.5s, suppress ALL mic transcripts
 * 2. Word overlap: compare mic words against recent system transcripts (35% threshold, 10s window)
 * 3. Session-wide: if 70%+ of mic words already appeared in system audio during this session
 */

import { createLogger } from '@/lib/logger'

const log = createLogger('Dedup')

// Configuration (aligned with macOS values)
const WINDOW_DURATION = 10_000 // 10s — how long to keep system transcripts for comparison
const TEMPORAL_SUPPRESSION_WINDOW = 1500 // 1.5s — suppress mic while system audio is active
const SIMILARITY_THRESHOLD = 0.35 // 35% word overlap = bleed
const MIN_WORDS_FOR_DEDUP = 2 // minimum word count to attempt dedup

interface RecentEntry {
  words: Set<string>
  timestamp: number
}

let recentSystemTranscripts: RecentEntry[] = []
let lastSystemTranscriptTime: number | null = null
let allSessionSystemWords: Set<string> = new Set()

/** Normalize text into a set of lowercase words, stripping punctuation */
function normalizeWords(text: string): Set<string> {
  const words = text
    .toLowerCase()
    .split(/[^a-zA-ZÀ-ÿ0-9]+/)
    .filter((w) => w.length > 1) // Drop single-char noise
  return new Set(words)
}

function pruneOldEntries(): void {
  const cutoff = Date.now() - WINDOW_DURATION
  recentSystemTranscripts = recentSystemTranscripts.filter((e) => e.timestamp > cutoff)
}

/**
 * Record a system audio transcript for future bleed comparison.
 * Call this EVERY time a system audio transcript (interim or final) is received.
 */
export function addSystemTranscript(text: string): void {
  const words = normalizeWords(text)
  if (words.size === 0) return

  lastSystemTranscriptTime = Date.now()
  recentSystemTranscripts.push({ words, timestamp: Date.now() })
  words.forEach((w) => allSessionSystemWords.add(w))
  pruneOldEntries()
}

/**
 * Check if a mic transcript is likely bleed from the speakers.
 * Returns true if the text should be dropped.
 */
export function isMicTranscriptBleed(text: string): boolean {
  pruneOldEntries()

  // Layer 1: Temporal suppression
  if (lastSystemTranscriptTime !== null) {
    const elapsed = Date.now() - lastSystemTranscriptTime
    if (elapsed < TEMPORAL_SUPPRESSION_WINDOW) {
      log.info(`Temporal suppression (system audio active ${(elapsed / 1000).toFixed(1)}s ago): "${text.substring(0, 60)}"`)
      return true
    }
  }

  const micWords = normalizeWords(text)
  if (micWords.size < MIN_WORDS_FOR_DEDUP) return false

  // Layer 2: Word overlap against recent window
  for (const entry of recentSystemTranscripts) {
    const common = new Set([...micWords].filter((w) => entry.words.has(w)))
    const maxCount = Math.max(micWords.size, entry.words.size)
    const similarity = common.size / maxCount

    if (similarity >= SIMILARITY_THRESHOLD) {
      log.info(`Word overlap (${Math.round(similarity * 100)}%): mic=${micWords.size} words, sys=${entry.words.size} words`)
      return true
    }
  }

  // Layer 3: Session-wide word overlap
  if (allSessionSystemWords.size > 0) {
    const common = new Set([...micWords].filter((w) => allSessionSystemWords.has(w)))
    const ratio = common.size / micWords.size
    if (ratio >= 0.7) {
      log.info(`Session-wide overlap (${Math.round(ratio * 100)}%): ${common.size}/${micWords.size} mic words seen in system audio`)
      return true
    }
  }

  return false
}

/** Reset all state (call on session end) */
export function reset(): void {
  recentSystemTranscripts = []
  lastSystemTranscriptTime = null
  allSessionSystemWords = new Set()
}
