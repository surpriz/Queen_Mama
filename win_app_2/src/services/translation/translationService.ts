/**
 * Orchestrator for real-time translation of interlocutor transcripts.
 * Best-effort, fire-and-forget — never blocks the original transcript flow.
 *
 * Flow: cache lookup → provider → write DB → relay IPC to overlay window.
 */

import { createLogger } from '@/lib/logger'
import * as sessionMgr from '@/services/session/sessionManager'
import {
  NoOpTranslationProvider,
  TranslationError,
  type TranslationProvider,
} from './translationProvider'
import { ProxyTranslationProvider } from './proxyTranslationProvider'
import { TranslationCache } from './translationCache'

const log = createLogger('TranslationService')

export interface TranslationUpdatePayload {
  entryId: string
  sessionId: string | null
  original: string
  translated: string
  sourceLang: string | null
  targetLang: string
  timestamp: string
}

const CONTEXT_WINDOW = 3

let proxyProvider: TranslationProvider = new ProxyTranslationProvider()
const cache = new TranslationCache(1000)
let contextBuffer: string[] = []
let lastError: TranslationError | null = null
const listeners = new Set<(err: TranslationError | null) => void>()

function activeProvider(): TranslationProvider {
  return proxyProvider.isConfigured ? proxyProvider : new NoOpTranslationProvider()
}

export function getLastError(): TranslationError | null {
  return lastError
}

export function onErrorChange(cb: (err: TranslationError | null) => void): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

function setError(err: TranslationError | null): void {
  if (lastError === err) return
  lastError = err
  listeners.forEach((cb) => cb(err))
}

export function clearError(): void {
  setError(null)
}

export function resetContext(): void {
  contextBuffer = []
}

export function getProviderStatus(): string {
  const p = activeProvider()
  return p.isConfigured ? p.providerName : 'Not available'
}

/** For tests / future BYO-key path. */
export function setProxyProvider(p: TranslationProvider): void {
  proxyProvider = p
}

function appendContext(chunk: string): void {
  contextBuffer.push(chunk)
  if (contextBuffer.length > CONTEXT_WINDOW) {
    contextBuffer = contextBuffer.slice(contextBuffer.length - CONTEXT_WINDOW)
  }
}

function broadcast(payload: TranslationUpdatePayload): void {
  try {
    window.electronAPI?.relay?.broadcast('relay:translation', payload as unknown as Record<string, unknown>)
  } catch (err) {
    log.error('Failed to broadcast translation update', err)
  }
}

/**
 * Translate one transcript entry. Fire-and-forget — caller should not await
 * (or should `.catch()` to swallow rejections). All errors are stored on
 * `lastError` and broadcast via listeners.
 */
export async function translate(params: {
  entryId: string
  sessionId: string | null
  text: string
  sourceLang: string | null | undefined
  targetLang: string
  timestamp?: string
}): Promise<void> {
  const trimmed = params.text.trim()
  if (!trimmed) return

  const effectiveSource =
    !params.sourceLang || params.sourceLang.toLowerCase() === 'auto' ? null : params.sourceLang
  const target = params.targetLang
  const timestamp = params.timestamp ?? new Date().toISOString()

  const cached = cache.lookup(trimmed, effectiveSource, target)
  if (cached !== null) {
    await sessionMgr.updateTranscriptEntryTranslation(
      params.entryId,
      cached,
      effectiveSource,
      target,
    )
    broadcast({
      entryId: params.entryId,
      sessionId: params.sessionId,
      original: trimmed,
      translated: cached,
      sourceLang: effectiveSource,
      targetLang: target,
      timestamp,
    })
    appendContext(trimmed)
    return
  }

  const context = contextBuffer.length === 0 ? null : contextBuffer.join(' ')

  try {
    const result = await activeProvider().translate({
      text: trimmed,
      sourceLang: effectiveSource,
      targetLang: target,
      context,
    })
    cache.store(trimmed, effectiveSource, target, result.translatedText)
    const detected = result.detectedSourceLang ?? effectiveSource
    await sessionMgr.updateTranscriptEntryTranslation(
      params.entryId,
      result.translatedText,
      detected,
      target,
    )
    broadcast({
      entryId: params.entryId,
      sessionId: params.sessionId,
      original: trimmed,
      translated: result.translatedText,
      sourceLang: detected,
      targetLang: target,
      timestamp,
    })
    appendContext(trimmed)
    if (lastError) setError(null)
  } catch (err) {
    const tErr =
      err instanceof TranslationError ? err : new TranslationError('requestFailed', String(err))
    setError(tErr)
    log.error(`Translation error: ${tErr.kind}`, tErr.detail ?? '')
  }
}
