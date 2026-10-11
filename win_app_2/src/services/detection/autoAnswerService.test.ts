import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as autoAnswer from './autoAnswerService'

const words = (n: number) => Array.from({ length: n }, (_, i) => `w${i}`).join(' ')

describe('autoAnswerService', () => {
  const trigger = vi.fn()

  beforeEach(() => {
    vi.useFakeTimers()
    trigger.mockClear()
    autoAnswer.reset()
    autoAnswer.setConfig({
      enabled: true,
      silenceThreshold: 2.5,
      cooldown: 10,
      minWordsForSilence: 20,
      minWordsForQuestion: 10,
      minWordsForSentence: 50,
    })
    autoAnswer.setOnTrigger(trigger)
  })

  afterEach(() => {
    autoAnswer.setOnTrigger(null)
    autoAnswer.reset()
    vi.useRealTimers()
  })

  it('fires on silence without any new transcript event (timer-driven)', () => {
    autoAnswer.onTranscriptReceived(`Moi: ${words(25)}`)
    expect(trigger).not.toHaveBeenCalled()
    vi.advanceTimersByTime(3000)
    expect(trigger).toHaveBeenCalledTimes(1)
  })

  it('does not fire while interim speech is active', () => {
    autoAnswer.onTranscriptReceived(`Moi: ${words(25)}`)
    vi.advanceTimersByTime(2000)
    autoAnswer.onInterimTranscript('still talking')
    vi.advanceTimersByTime(2000)
    expect(trigger).not.toHaveBeenCalled()
  })

  it('fires on a question immediately, then respects cooldown and dedups identical text', () => {
    autoAnswer.onTranscriptReceived(`Interlocuteur: ${words(12)} ?`)
    expect(trigger).toHaveBeenCalledTimes(1)
    autoAnswer.onTranscriptReceived(`Interlocuteur: ${words(12)} ?`)
    vi.advanceTimersByTime(30_000)
    expect(trigger).toHaveBeenCalledTimes(1) // same hash, never re-answered
  })

  it('stops monitoring when disabled mid-session', () => {
    autoAnswer.onTranscriptReceived(`Moi: ${words(25)}`)
    autoAnswer.setConfig({ enabled: false })
    vi.advanceTimersByTime(5000)
    expect(trigger).not.toHaveBeenCalled()
  })
})
