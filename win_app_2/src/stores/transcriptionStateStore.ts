import { create } from 'zustand'
import type { TranscriptionStateRelay } from '@/types/relay'

/** UI mirror of the transcription connection (overlay reconnect banner). */
interface TranscriptionStateStore extends TranscriptionStateRelay {
  apply: (data: TranscriptionStateRelay) => void
}

export const useTranscriptionStateStore = create<TranscriptionStateStore>((set) => ({
  connected: false,
  provider: null,
  recoveryCountdown: 0,
  connecting: false,
  apply: (data) =>
    set({
      connected: data.connected,
      provider: data.provider,
      recoveryCountdown: data.recoveryCountdown ?? 0,
      connecting: data.connecting ?? false,
    }),
}))
