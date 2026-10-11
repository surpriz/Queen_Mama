import { useMemo } from 'react'
import { useSessionStore } from '@/stores/sessionStore'
import * as sessionManager from '@/services/session/sessionManager'
import { exportSession, type ExportFormat } from '@/services/session/sessionExport'

export function useSession() {
  const sessions = useSessionStore((s) => s.sessions)
  const currentSession = useSessionStore((s) => s.currentSession)
  const searchQuery = useSessionStore((s) => s.searchQuery)
  const isLoading = useSessionStore((s) => s.isLoading)
  const filteredSessions = useSessionStore((s) => s.filteredSessions)
  const recentSessions = useSessionStore((s) => s.recentSessions)
  const setSearchQuery = useSessionStore((s) => s.setSearchQuery)
  const setCurrentSession = useSessionStore((s) => s.setCurrentSession)

  // Sort + filter only when the inputs change, not on every render
  const filtered = useMemo(() => filteredSessions(), [sessions, searchQuery]) // eslint-disable-line react-hooks/exhaustive-deps

  return {
    sessions,
    currentSession,
    searchQuery,
    isLoading,
    filteredSessions: filtered,
    recentSessions: (count: number) => recentSessions(count),
    setSearchQuery,
    setCurrentSession,
    startSession: sessionManager.startSession,
    endSession: sessionManager.endSession,
    deleteSession: sessionManager.deleteSession,
    deleteSessions: sessionManager.deleteSessions,
    updateTranscript: sessionManager.updateTranscript,
    setSummary: sessionManager.setSummary,
    exportSession: (format: ExportFormat) => {
      if (!currentSession) return ''
      return exportSession(currentSession, format)
    },
  }
}
