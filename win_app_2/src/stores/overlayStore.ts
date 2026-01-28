import { create } from 'zustand'
import { ResponseType } from '@/types/models'
import type { OverlayPosition } from '@/types/electron.d'

interface OverlayStoreState {
  isExpanded: boolean
  selectedTab: ResponseType
  position: OverlayPosition
  isAutoAnswer: boolean
  streamingContent: string
  responseHistory: Array<{ type: ResponseType; content: string; timestamp: string }>

  // Actions
  setExpanded: (expanded: boolean) => void
  toggleExpanded: () => void
  setSelectedTab: (tab: ResponseType) => void
  setPosition: (position: OverlayPosition) => void
  setAutoAnswer: (enabled: boolean) => void
  setStreamingContent: (content: string) => void
  appendStreamingContent: (chunk: string) => void
  addToHistory: (type: ResponseType, content: string) => void
  clearHistory: () => void
}

export const useOverlayStore = create<OverlayStoreState>((set) => ({
  isExpanded: false,
  selectedTab: ResponseType.Assist,
  position: 'bottomRight',
  isAutoAnswer: false,
  streamingContent: '',
  responseHistory: [],

  setExpanded: (expanded) => {
    set({ isExpanded: expanded })
    window.electronAPI?.overlaySetExpanded(expanded)
  },
  toggleExpanded: () =>
    set((state) => {
      const newExpanded = !state.isExpanded
      window.electronAPI?.overlaySetExpanded(newExpanded)
      return { isExpanded: newExpanded }
    }),
  setSelectedTab: (tab) => set({ selectedTab: tab }),
  setPosition: (position) => {
    set({ position })
    window.electronAPI?.overlaySetPosition(position)
  },
  setAutoAnswer: (enabled) => set({ isAutoAnswer: enabled }),
  setStreamingContent: (content) => set({ streamingContent: content }),
  appendStreamingContent: (chunk) =>
    set((state) => ({ streamingContent: state.streamingContent + chunk })),
  addToHistory: (type, content) =>
    set((state) => ({
      responseHistory: [
        { type, content, timestamp: new Date().toISOString() },
        ...state.responseHistory,
      ],
    })),
  clearHistory: () => set({ responseHistory: [], streamingContent: '' }),
}))
