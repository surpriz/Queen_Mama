import { create } from 'zustand'
import type { Mode } from '@/types/models'

interface AppState {
  // Session state
  isSessionActive: boolean
  sessionStartedAt: number | null // Date.now() timestamp
  isOverlayVisible: boolean
  currentTranscript: string
  interimTranscript: string
  aiResponse: string
  isProcessing: boolean
  audioLevel: number
  selectedMode: Mode | null
  errorMessage: string | null
  isFinalizingSession: boolean
  sessionJustFinalized: boolean

  // Actions
  setSessionActive: (active: boolean) => void
  setOverlayVisible: (visible: boolean) => void
  setCurrentTranscript: (transcript: string) => void
  appendTranscript: (text: string) => void
  setInterimTranscript: (text: string) => void
  setAiResponse: (response: string) => void
  setProcessing: (processing: boolean) => void
  setAudioLevel: (level: number) => void
  setSelectedMode: (mode: Mode | null) => void
  setErrorMessage: (message: string | null) => void
  setFinalizingSession: (finalizing: boolean) => void
  setSessionJustFinalized: (finalized: boolean) => void
  clearContext: () => void
  toggleOverlay: () => void
}

export const useAppStore = create<AppState>((set) => ({
  isSessionActive: false,
  sessionStartedAt: null,
  isOverlayVisible: true,
  currentTranscript: '',
  interimTranscript: '',
  aiResponse: '',
  isProcessing: false,
  audioLevel: 0,
  selectedMode: null,
  errorMessage: null,
  isFinalizingSession: false,
  sessionJustFinalized: false,

  setSessionActive: (active) => {
    set({ isSessionActive: active, sessionStartedAt: active ? Date.now() : null })
    // Update tray icon
    window.electronAPI?.updateTrayIcon(active)
  },
  setOverlayVisible: (visible) => set({ isOverlayVisible: visible }),
  setCurrentTranscript: (transcript) => set({ currentTranscript: transcript }),
  appendTranscript: (text) =>
    set((state) => ({ currentTranscript: state.currentTranscript + text + ' ' })),
  setInterimTranscript: (text) => set({ interimTranscript: text }),
  setAiResponse: (response) => set({ aiResponse: response }),
  setProcessing: (processing) => set({ isProcessing: processing }),
  setAudioLevel: (level) => set({ audioLevel: level }),
  setSelectedMode: (mode) => set({ selectedMode: mode }),
  setErrorMessage: (message) => set({ errorMessage: message }),
  setFinalizingSession: (finalizing) => set({ isFinalizingSession: finalizing }),
  setSessionJustFinalized: (finalized) => set({ sessionJustFinalized: finalized }),
  clearContext: () =>
    set({
      currentTranscript: '',
      interimTranscript: '',
      aiResponse: '',
    }),
  toggleOverlay: () =>
    set((state) => {
      const newVisible = !state.isOverlayVisible
      if (newVisible) {
        window.electronAPI?.overlayShow()
      } else {
        window.electronAPI?.overlayHide()
      }
      return { isOverlayVisible: newVisible }
    }),
}))
