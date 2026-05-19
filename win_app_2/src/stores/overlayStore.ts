import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import { ResponseType } from '@/types/models'
import type { OverlayPosition } from '@/types/electron.d'
import { db } from '@/db/client'

const MAX_RESPONSES_IN_MEMORY = 50
const MAX_TRANSLATION_ENTRIES = 500

export interface TranslationEntry {
  entryId: string
  original: string
  translated: string
  sourceLang: string | null
  targetLang: string
  timestamp: string
}

// Set externally by sessionLifecycle to avoid circular imports
let _currentSessionId: string | null = null
export function setOverlaySessionId(id: string | null): void {
  _currentSessionId = id
}

interface OverlayStoreState {
  isExpanded: boolean
  selectedTab: ResponseType
  position: OverlayPosition
  isAutoAnswer: boolean
  streamingContent: string
  responseHistory: Array<{ type: ResponseType; content: string; timestamp: string; provider?: string }>
  translationEntries: TranslationEntry[]
  translationError: string | null

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
  appendTranslation: (entry: TranslationEntry) => void
  clearTranslations: () => void
  setTranslationError: (msg: string | null) => void
}

export const useOverlayStore = create<OverlayStoreState>((set) => ({
  isExpanded: false,
  selectedTab: ResponseType.Assist,
  position: 'topRight',
  isAutoAnswer: false,
  streamingContent: '',
  responseHistory: [],
  translationEntries: [],
  translationError: null,

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
    set((state) => {
      // Dedup: skip if the most recent entry has identical content
      const last = state.responseHistory[0]
      if (last && last.content === content && last.type === type) {
        return state
      }
      const timestamp = new Date().toISOString()
      const updated = [
        { type, content, timestamp },
        ...state.responseHistory,
      ]

      // Persist AI response to DB (fire-and-forget)
      if (_currentSessionId) {
        db.query(
          `INSERT INTO ai_responses (id, session_id, type, content, timestamp, is_automatic)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [uuidv4(), _currentSessionId, type, content, timestamp, 0],
        ).catch(() => {})
      }

      return {
        responseHistory: updated.length > MAX_RESPONSES_IN_MEMORY
          ? updated.slice(0, MAX_RESPONSES_IN_MEMORY)
          : updated,
      }
    }),
  clearHistory: () => set({ responseHistory: [], streamingContent: '' }),
  appendTranslation: (entry) =>
    set((state) => {
      // Dedup: replace existing entry for same entryId (cache hit / retry)
      const existingIndex = state.translationEntries.findIndex((e) => e.entryId === entry.entryId)
      let updated: TranslationEntry[]
      if (existingIndex >= 0) {
        updated = [...state.translationEntries]
        updated[existingIndex] = entry
      } else {
        updated = [...state.translationEntries, entry]
      }
      if (updated.length > MAX_TRANSLATION_ENTRIES) {
        updated = updated.slice(updated.length - MAX_TRANSLATION_ENTRIES)
      }
      return { translationEntries: updated, translationError: null }
    }),
  clearTranslations: () => set({ translationEntries: [], translationError: null }),
  setTranslationError: (msg) => set({ translationError: msg }),
}))

// Subscribe to cross-window translation updates (works in both dashboard + overlay).
if (typeof window !== 'undefined' && window.electronAPI?.onTranslationUpdate) {
  window.electronAPI.onTranslationUpdate((payload) => {
    useOverlayStore.getState().appendTranslation({
      entryId: payload.entryId,
      original: payload.original,
      translated: payload.translated,
      sourceLang: payload.sourceLang,
      targetLang: payload.targetLang,
      timestamp: payload.timestamp,
    })
  })
}
