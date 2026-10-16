import { create } from 'zustand'
import type { DictationRelay } from '@/types/relay'

/** UI mirror of the host's dictation state (the microphone lives in the host). */
interface DictationStoreState {
  isRecording: boolean
  interimText: string
  finalText: string
  error: string | null
  apply: (data: DictationRelay) => void
  reset: () => void
}

export const useDictationStore = create<DictationStoreState>((set) => ({
  isRecording: false,
  interimText: '',
  finalText: '',
  error: null,
  apply: (data) =>
    set({
      isRecording: data.isRecording,
      interimText: data.interimText,
      finalText: data.finalText,
      error: data.error ?? null,
    }),
  reset: () => set({ isRecording: false, interimText: '', finalText: '', error: null }),
}))
