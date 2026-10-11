import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import { ResponseType } from '@/types/models'
import type { OverlayPosition } from '@/types/electron.d'
import { db } from '@/db/client'
import { createLogger } from '@/lib/logger'

const log = createLogger('OverlayStore')

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
export interface ResponseHistoryEntry {
  id: string
  type: ResponseType
  content: string
  timestamp: string
  provider?: string
  isAutomatic?: boolean
  sessionId?: string | null
}

/** Optional identity/metadata for an entry produced elsewhere (host → UI relay). */
export interface HistoryEntryMeta {
  id?: string
  timestamp?: string
  provider?: string
  isAutomatic?: boolean
  sessionId?: string | null
}

let _currentSessionId: string | null = null
export function setOverlaySessionId(id: string | null): void {
  _currentSessionId = id
}
export function getOverlaySessionId(): string | null {
  return _currentSessionId
}

interface OverlayStoreState {
  isExpanded: boolean
  selectedTab: ResponseType
  position: OverlayPosition
  isAutoAnswer: boolean
  streamingContent: string
  responseHistory: ResponseHistoryEntry[]
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
  addToHistory: (type: ResponseType, content: string, meta?: HistoryEntryMeta) => void
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

  // The window resize IPC is sent once, by OverlayContent's effect on
  // `isExpanded` (it used to be sent 2–3 times per toggle).
  setExpanded: (expanded) => set({ isExpanded: expanded }),
  toggleExpanded: () => set((state) => ({ isExpanded: !state.isExpanded })),
  setSelectedTab: (tab) => set({ selectedTab: tab }),
  setPosition: (position) => {
    set({ position })
    window.electronAPI?.overlaySetPosition(position)
  },
  setAutoAnswer: (enabled) => set({ isAutoAnswer: enabled }),
  setStreamingContent: (content) => set({ streamingContent: content }),
  appendStreamingContent: (chunk) =>
    set((state) => ({ streamingContent: state.streamingContent + chunk })),
  addToHistory: (type, content, meta) =>
    set((state) => {
      // Dedup by id when the entry comes from the host, otherwise by content
      if (meta?.id && state.responseHistory.some((e) => e.id === meta.id)) {
        return state
      }
      const last = state.responseHistory[0]
      if (!meta?.id && last && last.content === content && last.type === type) {
        return state
      }
      const timestamp = meta?.timestamp ?? new Date().toISOString()
      const id = meta?.id ?? uuidv4()
      const sessionId = meta?.sessionId !== undefined ? meta.sessionId : _currentSessionId
      const entry: ResponseHistoryEntry = {
        id,
        type,
        content,
        timestamp,
        sessionId,
        provider: meta?.provider,
        isAutomatic: meta?.isAutomatic,
      }
      const updated = [entry, ...state.responseHistory]

      // Persist AI response to DB (fire-and-forget). Only the session host has
      // a current session id, so UI windows never write duplicates.
      if (_currentSessionId && (!meta?.sessionId || meta.sessionId === _currentSessionId)) {
        db.query(
          `INSERT INTO ai_responses (id, session_id, type, content, timestamp, is_automatic)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [id, _currentSessionId, type, content, timestamp, meta?.isAutomatic ? 1 : 0],
        ).catch((err) => log.warn('Failed to persist AI response to DB', err))
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
