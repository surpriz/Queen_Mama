import { create } from 'zustand'
import type { Mode, ResponseType } from '@/types/models'

interface AppState {
  // Session state
  isSessionActive: boolean
  isOverlayVisible: boolean
  currentTranscript: string
  aiResponse: string
  isProcessing: boolean
  audioLevel: number
  selectedMode: Mode | null
  errorMessage: string | null
  isFinalizingSession: boolean

  // Actions
  setSessionActive: (active: boolean) => void
  setOverlayVisible: (visible: boolean) => void
  setCurrentTranscript: (transcript: string) => void
  appendTranscript: (text: string) => void
  setAiResponse: (response: string) => void
  setProcessing: (processing: boolean) => void
  setAudioLevel: (level: number) => void
  setSelectedMode: (mode: Mode | null) => void
  setErrorMessage: (message: string | null) => void
  setFinalizingSession: (finalizing: boolean) => void
  clearContext: () => void
  toggleOverlay: () => void
}

export const useAppStore = create<AppState>((set) => ({
  isSessionActive: false,
  isOverlayVisible: true,
  currentTranscript: '',
  aiResponse: '',
  isProcessing: false,
  audioLevel: 0,
  selectedMode: null,
  errorMessage: null,
  isFinalizingSession: false,

  setSessionActive: (active) => {
    set({ isSessionActive: active })
    // Update tray icon
    window.electronAPI?.updateTrayIcon(active)
  },
  setOverlayVisible: (visible) => set({ isOverlayVisible: visible }),
  setCurrentTranscript: (transcript) => set({ currentTranscript: transcript }),
  appendTranscript: (text) =>
    set((state) => ({ currentTranscript: state.currentTranscript + text + ' ' })),
  setAiResponse: (response) => set({ aiResponse: response }),
  setProcessing: (processing) => set({ isProcessing: processing }),
  setAudioLevel: (level) => set({ audioLevel: level }),
  setSelectedMode: (mode) => set({ selectedMode: mode }),
  setErrorMessage: (message) => set({ errorMessage: message }),
  setFinalizingSession: (finalizing) => set({ isFinalizingSession: finalizing }),
  clearContext: () =>
    set({
      currentTranscript: '',
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
