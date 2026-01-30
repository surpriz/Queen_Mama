import { create } from 'zustand'
import type { Session } from '@/types/models'

interface SessionStoreState {
  sessions: Session[]
  currentSession: Session | null
  searchQuery: string
  isLoading: boolean

  // Actions
  setSessions: (sessions: Session[]) => void
  addSession: (session: Session) => void
  updateSession: (id: string, updates: Partial<Session>) => void
  removeSession: (id: string) => void
  setCurrentSession: (session: Session | null) => void
  setSearchQuery: (query: string) => void
  setLoading: (loading: boolean) => void

  // Computed
  filteredSessions: () => Session[]
  recentSessions: (count: number) => Session[]
}

export const useSessionStore = create<SessionStoreState>((set, get) => ({
  sessions: [],
  currentSession: null,
  searchQuery: '',
  isLoading: false,

  setSessions: (sessions) => set({ sessions }),
  addSession: (session) =>
    set((state) => ({ sessions: [session, ...state.sessions] })),
  updateSession: (id, updates) =>
    set((state) => ({
      sessions: state.sessions.map((s) => (s.id === id ? { ...s, ...updates } : s)),
      currentSession:
        state.currentSession?.id === id
          ? { ...state.currentSession, ...updates }
          : state.currentSession,
    })),
  removeSession: (id) =>
    set((state) => ({
      sessions: state.sessions.filter((s) => s.id !== id),
      currentSession: state.currentSession?.id === id ? null : state.currentSession,
    })),
  setCurrentSession: (session) => set({ currentSession: session }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setLoading: (loading) => set({ isLoading: loading }),

  filteredSessions: () => {
    const { sessions, searchQuery } = get()
    if (!searchQuery.trim()) return sessions
    const q = searchQuery.toLowerCase()
    return sessions.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.transcript.toLowerCase().includes(q) ||
        s.summary?.toLowerCase().includes(q),
    )
  },

  recentSessions: (count) => {
    const { sessions } = get()
    return sessions
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
      .slice(0, count)
  },
}))
