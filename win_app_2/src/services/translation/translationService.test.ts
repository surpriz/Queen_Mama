import { describe, it, expect, beforeEach, vi } from 'vitest'
import * as translationService from './translationService'
import {
  TranslationError,
  type TranslationProvider,
  type TranslationResult,
} from './translationProvider'

// Isolate the orchestrator from persistence/IPC: spy on the DB write.
vi.mock('@/services/session/sessionManager', () => ({
  updateTranscriptEntryTranslation: vi.fn().mockResolvedValue(undefined),
}))

import * as sessionMgr from '@/services/session/sessionManager'

const updateSpy = vi.mocked(sessionMgr.updateTranscriptEntryTranslation)

/** Configurable mock provider — canned result, optional error, call tracking. */
class MockTranslationProvider implements TranslationProvider {
  readonly providerName = 'Mock'
  isConfigured = true

  calls: Array<{ text: string; sourceLang?: string | null; context?: string | null }> = []
  result: TranslationResult = {
    translatedText: 'TRANSLATED',
    detectedSourceLang: null,
    targetLang: 'EN-US',
    provider: 'Mock',
    latencyMs: 1,
    cached: false,
  }
  errorToThrow: unknown = null

  async translate(input: {
    text: string
    sourceLang?: string | null
    targetLang: string
    context?: string | null
  }): Promise<TranslationResult> {
    this.calls.push({ text: input.text, sourceLang: input.sourceLang, context: input.context })
    if (this.errorToThrow) throw this.errorToThrow
    return { ...this.result, targetLang: input.targetLang }
  }
}

let mock: MockTranslationProvider

const base = { entryId: 'entry-1', sessionId: 'sess-1', targetLang: 'EN-US' }

// NOTE: translationService holds a module-level LRU cache (global by design, not
// session-scoped). It is NOT reset between tests, so every test below uses a
// distinct source string to avoid leaking cache hits across cases.
beforeEach(() => {
  vi.clearAllMocks()
  mock = new MockTranslationProvider()
  translationService.setProxyProvider(mock)
  translationService.resetContext()
  translationService.clearError()
})

describe('translationService.translate', () => {
  it('skips empty / whitespace-only text', async () => {
    await translationService.translate({ ...base, text: '   ', sourceLang: 'auto' })
    expect(mock.calls).toHaveLength(0)
    expect(updateSpy).not.toHaveBeenCalled()
  })

  it('normalizes "auto" source to null when calling the provider', async () => {
    await translationService.translate({ ...base, text: 'norm-auto-chunk', sourceLang: 'auto' })
    expect(mock.calls[0].sourceLang).toBeNull()
  })

  it('writes the detected source language back to the entry', async () => {
    mock.result = { ...mock.result, detectedSourceLang: 'FR' }
    await translationService.translate({ ...base, text: 'detected-src-chunk', sourceLang: 'auto' })
    expect(updateSpy).toHaveBeenCalledWith('entry-1', 'TRANSLATED', 'FR', 'EN-US')
  })

  it('serves a repeated chunk from cache (provider called once)', async () => {
    await translationService.translate({ ...base, text: 'cache-hit-chunk', sourceLang: 'EN-US' })
    await translationService.translate({ ...base, text: 'cache-hit-chunk', sourceLang: 'EN-US' })
    expect(mock.calls).toHaveLength(1)
    // Both calls still write back to the entry.
    expect(updateSpy).toHaveBeenCalledTimes(2)
  })

  describe('error handling', () => {
    it('swallows a TranslationError and records it on lastError', async () => {
      mock.errorToThrow = new TranslationError('rateLimited', '429')
      await expect(
        translationService.translate({ ...base, text: 'err-rate-chunk', sourceLang: 'auto' }),
      ).resolves.toBeUndefined()
      expect(translationService.getLastError()?.kind).toBe('rateLimited')
      expect(updateSpy).not.toHaveBeenCalled()
    })

    it('maps a non-TranslationError throw to requestFailed', async () => {
      mock.errorToThrow = new Error('socket hang up')
      await translationService.translate({ ...base, text: 'err-generic-chunk', sourceLang: 'auto' })
      expect(translationService.getLastError()?.kind).toBe('requestFailed')
    })

    it('clears a prior error on the next success', async () => {
      mock.errorToThrow = new TranslationError('rateLimited')
      await translationService.translate({ ...base, text: 'err-clear-first', sourceLang: 'auto' })
      expect(translationService.getLastError()).not.toBeNull()

      mock.errorToThrow = null
      await translationService.translate({ ...base, text: 'err-clear-second', sourceLang: 'auto' })
      expect(translationService.getLastError()).toBeNull()
    })
  })

  describe('rolling context window (size 3)', () => {
    it('passes the preceding chunks as context, capped at 3', async () => {
      await translationService.translate({ ...base, text: 'r1', sourceLang: 'auto' })
      await translationService.translate({ ...base, text: 'r2', sourceLang: 'auto' })
      await translationService.translate({ ...base, text: 'r3', sourceLang: 'auto' })
      await translationService.translate({ ...base, text: 'r4', sourceLang: 'auto' })
      await translationService.translate({ ...base, text: 'r5', sourceLang: 'auto' })

      expect(mock.calls[0].context).toBeNull()
      expect(mock.calls[1].context).toBe('r1')
      expect(mock.calls[2].context).toBe('r1 r2')
      expect(mock.calls[3].context).toBe('r1 r2 r3') // window full (3 preceding)
      expect(mock.calls[4].context).toBe('r2 r3 r4') // oldest (r1) evicted
    })

    it('resetContext() clears the rolling window', async () => {
      await translationService.translate({ ...base, text: 'x1', sourceLang: 'auto' })
      translationService.resetContext()
      await translationService.translate({ ...base, text: 'x2', sourceLang: 'auto' })
      expect(mock.calls[1].context).toBeNull()
    })

    it('a cache hit still advances the context window', async () => {
      await translationService.translate({ ...base, text: 'h1', sourceLang: 'auto' })
      // 'h1' again → cache hit (no provider call) but should still append to context.
      await translationService.translate({ ...base, text: 'h1', sourceLang: 'auto' })
      await translationService.translate({ ...base, text: 'h2', sourceLang: 'auto' })
      const h2Call = mock.calls.find((c) => c.text === 'h2')
      expect(h2Call?.context).toBe('h1 h1')
    })
  })
})
