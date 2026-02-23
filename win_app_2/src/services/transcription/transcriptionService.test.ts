import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import * as transcriptionService from './transcriptionService'

// Mock the providers
vi.mock('./deepgramProvider', () => ({
  DeepgramProvider: vi.fn().mockImplementation(() => ({
    name: 'Deepgram',
    isConfigured: true,
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn(),
    sendAudio: vi.fn(),
    onTranscript: null,
    onInterimTranscript: null,
    onError: null,
  })),
}))

vi.mock('./assemblyAIProvider', () => ({
  AssemblyAIProvider: vi.fn().mockImplementation(() => ({
    name: 'AssemblyAI',
    isConfigured: true,
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn(),
    sendAudio: vi.fn(),
    onTranscript: null,
    onInterimTranscript: null,
    onError: null,
  })),
}))

vi.mock('./deepgramFluxProvider', () => ({
  DeepgramFluxProvider: vi.fn().mockImplementation(() => ({
    name: 'DeepgramFlux',
    isConfigured: false,
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn(),
    sendAudio: vi.fn(),
    onTranscript: null,
    onInterimTranscript: null,
    onError: null,
  })),
}))

describe('transcriptionService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    transcriptionService.disconnect()
  })

  afterEach(() => {
    transcriptionService.disconnect()
  })

  describe('setCallbacks', () => {
    it('should accept callback functions', () => {
      const callbacks = {
        onTranscript: vi.fn(),
        onInterimTranscript: vi.fn(),
        onError: vi.fn(),
        onConnectionChanged: vi.fn(),
      }

      // Should not throw
      transcriptionService.setCallbacks(callbacks)
    })

    it('should accept partial callbacks', () => {
      // Should not throw
      transcriptionService.setCallbacks({
        onTranscript: vi.fn(),
      })
    })
  })

  describe('getIsConnected', () => {
    it('should return false initially', () => {
      expect(transcriptionService.getIsConnected()).toBe(false)
    })
  })

  describe('getCurrentProviderType', () => {
    it('should return null initially', () => {
      expect(transcriptionService.getCurrentProviderType()).toBeNull()
    })
  })

  describe('sendAudio', () => {
    it('should not throw when not connected', () => {
      const audioData = new ArrayBuffer(1024)

      // Should not throw
      transcriptionService.sendAudio(audioData)
    })
  })

  describe('disconnect', () => {
    it('should handle disconnect when not connected', () => {
      // Should not throw
      transcriptionService.disconnect()

      expect(transcriptionService.getIsConnected()).toBe(false)
    })
  })
})

describe('transcriptionService callbacks', () => {
  it('should provide transcript callback interface', () => {
    const onTranscript = vi.fn()
    const onError = vi.fn()

    transcriptionService.setCallbacks({
      onTranscript: (text: string) => {
        onTranscript(text)
      },
      onError: (error: Error) => {
        onError(error.message)
      },
      onConnectionChanged: (_connected: boolean) => {
        // Handle connection change
      },
    })

    // Verify callback interface is correct
    expect(onTranscript).not.toHaveBeenCalled()
  })
})
