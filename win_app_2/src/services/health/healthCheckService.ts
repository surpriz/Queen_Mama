/**
 * HealthCheckService — session-time health monitoring (port of the macOS
 * `HealthCheckService.swift`, trimmed to what the renderer can observe).
 *
 * Every 30 s during a session it checks JS heap usage, AI response latency,
 * transcription throughput and connection stability, reports anomalies to
 * Sentry (throttled) and logs a summary when the session ends.
 */

import { createLogger } from '@/lib/logger'
import { addBreadcrumb, captureMessage } from '@/services/crash/crashReporter'
import * as transcription from '@/services/transcription/transcriptionService'

const log = createLogger('Health')

const CHECK_INTERVAL_MS = 30_000
const MEMORY_WARNING_MB = 500
const MEMORY_CRITICAL_MB = 900
const AI_LATENCY_WARNING_MS = 12_000
const TRANSCRIPTION_STALL_SECONDS = 90
const RECONNECTS_WARNING = 3
const ANOMALY_REPORT_INTERVAL_MS = 10 * 60 * 1000

interface PerformanceMemory {
  usedJSHeapSize: number
}

let timer: ReturnType<typeof setInterval> | null = null
let sessionStartedAt = 0
let aiLatencies: number[] = []
let wordsTranscribed = 0
let lastWordAt = 0
let lastAnomalyReport = new Map<string, number>()
let anomalies = 0

function heapMB(): number | null {
  const mem = (performance as unknown as { memory?: PerformanceMemory }).memory
  if (!mem) return null
  return mem.usedJSHeapSize / (1024 * 1024)
}

function reportAnomaly(type: string, message: string, level: 'warning' | 'error', extra: Record<string, unknown>): void {
  anomalies++
  log.warn(`[${type}] ${message}`, extra)
  const now = Date.now()
  const last = lastAnomalyReport.get(type) ?? 0
  if (now - last < ANOMALY_REPORT_INTERVAL_MS) return
  lastAnomalyReport.set(type, now)
  const details = { ...extra, sessionAgeSec: Math.round((now - sessionStartedAt) / 1000) }
  captureMessage(`health_${type}: ${message} ${JSON.stringify(details)}`, level).catch(() => undefined)
}

function runChecks(): void {
  const now = Date.now()

  const mb = heapMB()
  if (mb !== null) {
    if (mb > MEMORY_CRITICAL_MB) {
      reportAnomaly('memory_critical', `JS heap ${mb.toFixed(0)} MB`, 'error', { heapMB: Math.round(mb) })
    } else if (mb > MEMORY_WARNING_MB) {
      reportAnomaly('memory_high', `JS heap ${mb.toFixed(0)} MB`, 'warning', { heapMB: Math.round(mb) })
    }
  }

  if (aiLatencies.length > 0) {
    const avg = aiLatencies.reduce((a, b) => a + b, 0) / aiLatencies.length
    if (avg > AI_LATENCY_WARNING_MS) {
      reportAnomaly('ai_slow', `avg AI latency ${Math.round(avg)} ms over ${aiLatencies.length} requests`, 'warning', {
        avgMs: Math.round(avg),
        samples: aiLatencies.length,
      })
    }
  }

  if (lastWordAt > 0 && now - lastWordAt > TRANSCRIPTION_STALL_SECONDS * 1000 && transcription.getIsConnected()) {
    reportAnomaly('transcription_stall', `no words for ${Math.round((now - lastWordAt) / 1000)} s while connected`, 'warning', {
      silenceSec: Math.round((now - lastWordAt) / 1000),
    })
  }

  const reconnects = transcription.getReconnectCount()
  if (reconnects >= RECONNECTS_WARNING) {
    reportAnomaly('unstable_connection', `${reconnects} transcription reconnects this session`, 'warning', { reconnects })
  }
}

export function startMonitoring(): void {
  stopMonitoring()
  sessionStartedAt = Date.now()
  aiLatencies = []
  wordsTranscribed = 0
  lastWordAt = 0
  lastAnomalyReport = new Map()
  anomalies = 0
  timer = setInterval(runChecks, CHECK_INTERVAL_MS)
  log.info('Health monitoring started')
}

export function stopMonitoring(): void {
  if (!timer) return
  clearInterval(timer)
  timer = null

  const durationSec = Math.round((Date.now() - sessionStartedAt) / 1000)
  const avgAi = aiLatencies.length ? Math.round(aiLatencies.reduce((a, b) => a + b, 0) / aiLatencies.length) : null
  const wpm = durationSec > 0 ? Math.round((wordsTranscribed / durationSec) * 60) : 0
  const summary = {
    durationSec,
    wordsTranscribed,
    wordsPerMinute: wpm,
    aiRequests: aiLatencies.length,
    avgAiLatencyMs: avgAi,
    reconnects: transcription.getReconnectCount(),
    heapMB: heapMB() !== null ? Math.round(heapMB() as number) : null,
    anomalies,
  }
  log.info('Session health summary', summary)
  addBreadcrumb('health', `Session summary: ${JSON.stringify(summary)}`, 'info')
}

export function recordAIResponseTime(ms: number): void {
  aiLatencies.push(ms)
  if (aiLatencies.length > 50) aiLatencies.shift()
}

export function recordWordsTranscribed(count: number): void {
  if (count <= 0) return
  wordsTranscribed += count
  lastWordAt = Date.now()
}
