import { useSessionStore } from '@/stores/sessionStore'
import * as sessionManager from '@/services/session/sessionManager'
import { exportSession, type ExportFormat } from '@/services/session/sessionExport'

export function useSession() {
  const {
    sessions,
    currentSession,
    searchQuery,
    isLoading,
    filteredSessions,
    recentSessions,
    setSearchQuery,
    setCurrentSession,
  } = useSessionStore()

  return {
    sessions,
    currentSession,
    searchQuery,
    isLoading,
    filteredSessions: filteredSessions(),
    recentSessions: (count: number) => recentSessions(count),
    setSearchQuery,
    setCurrentSession,
    startSession: sessionManager.startSession,
    endSession: sessionManager.endSession,
    deleteSession: sessionManager.deleteSession,
    updateTranscript: sessionManager.updateTranscript,
    setSummary: sessionManager.setSummary,
    exportSession: (format: ExportFormat) => {
      if (!currentSession) return ''
      return exportSession(currentSession, format)
    },
  }
}
