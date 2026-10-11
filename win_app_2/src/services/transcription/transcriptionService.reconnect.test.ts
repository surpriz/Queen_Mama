import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

/**
 * Reconnect budget: before the fix `connect()` reset the attempt counter on
 * every retry, so the 8-attempt cap was unreachable and auto-recovery never
 * started. Here a provider that always fails must exhaust the budget and hand
 * over to auto-recovery (observable through onReconnectionBudgetExhausted).
 */

const h = vi.hoisted(() => {
  const state = { connectAttempts: 0, failUntilAttempt: Number.POSITIVE_INFINITY }
  class FakeProvider {
    readonly name: string
    readonly isConfigured = true
    language = 'multi'
    diarize = false
    onTranscript: ((text: string) => void) | null = null
    onInterimTranscript: ((text: string) => void) | null = null
    onDiarizedTranscript: ((text: string, speaker: number) => void) | null = null
    onError: ((error: Error) => void) | null = null
    constructor(name: string) {
      this.name = name
    }
    async connect(): Promise<void> {
      state.connectAttempts++
      if (state.connectAttempts <= state.failUntilAttempt) throw new Error(`fail #${state.connectAttempts}`)
    }
    disconnect(): void {}
    sendAudio(): void {}
  }
  return { state, FakeProvider }
})
type FakeProvider = InstanceType<typeof h.FakeProvider>

vi.mock('./deepgramProvider', () => ({ DeepgramProvider: class extends h.FakeProvider { constructor() { super('Deepgram') } } }))
vi.mock('./deepgramFluxProvider', () => ({ DeepgramFluxProvider: class extends h.FakeProvider { constructor() { super('Deepgram Flux') } } }))
vi.mock('./assemblyAIProvider', () => ({ AssemblyAIProvider: class extends h.FakeProvider { constructor() { super('AssemblyAI') } } }))
vi.mock('../crash/crashReporter', () => ({
  captureError: vi.fn(),
  addBreadcrumb: vi.fn(),
}))

import * as transcription from './transcriptionService'
import { captureError } from '../crash/crashReporter'

describe('transcriptionService reconnect budget', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    h.state.connectAttempts = 0
    h.state.failUntilAttempt = Number.POSITIVE_INFINITY
    vi.mocked(captureError).mockClear()
  })

  afterEach(() => {
    transcription.disconnect()
    vi.useRealTimers()
  })

  it('exhausts the 8-attempt budget and starts auto-recovery instead of retrying forever', async () => {
    h.state.failUntilAttempt = 1 // first connect succeeds, everything after fails
    const budget = vi.fn()
    transcription.setCallbacks({ onReconnectionBudgetExhausted: budget })
    transcription.resetDisconnectFlag()
    await transcription.connect()
    expect(transcription.getIsConnected()).toBe(true)

    // Simulate a drop on the active provider → reconnect loop with backoff
    h.state.failUntilAttempt = Number.POSITIVE_INFINITY
    const active = (transcription as unknown as { __test_getProvider?: () => FakeProvider }).__test_getProvider?.()
    expect(active).toBeDefined()
    active!.onError?.(new Error('socket closed'))

    // Backoff: 3s·2^(n-1) + up to 50 % jitter, capped at 60 s. Advance well past 8 attempts.
    for (let i = 0; i < 12; i++) {
      await vi.advanceTimersByTimeAsync(95_000)
    }

    expect(budget).toHaveBeenCalled()
    // Bounded: 1 initial + 8 reconnects × 3 providers + 5 recovery cycles × 3 providers,
    // then recovery gives up for good (countdown -1) instead of retrying forever.
    expect(h.state.connectAttempts).toBeLessThanOrEqual(1 + 8 * 3 + 5 * 3 + 3)
    expect(budget.mock.calls.some((c) => c[0] === -1)).toBe(true)
    // "all providers failed" is reported once per session, not on every retry
    const allFailed = vi.mocked(captureError).mock.calls.filter((c) => (c[1] as { phase?: string })?.phase === 'all_providers_failed')
    expect(allFailed.length).toBe(1)
  })

  it('ignores errors from a provider that is not the active one', async () => {
    h.state.failUntilAttempt = 0
    transcription.resetDisconnectFlag()
    await transcription.connect()
    const attemptsAfterConnect = h.state.connectAttempts

    const stray = new h.FakeProvider('stray')
    // An inactive provider's error must not trigger a reconnect
    const active = (transcription as unknown as { __test_getProvider?: () => FakeProvider }).__test_getProvider?.()
    expect(active).not.toBe(stray)
    stray.onError?.(new Error('late close'))
    await vi.advanceTimersByTimeAsync(10_000)
    expect(h.state.connectAttempts).toBe(attemptsAfterConnect)
    expect(transcription.getIsConnected()).toBe(true)
  })
})
