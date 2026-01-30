import { v4 as uuidv4 } from 'uuid'
import { createLogger } from '@/lib/logger'
import { useSessionStore } from '@/stores/sessionStore'
import { debounce } from '@/lib/utils'
import type { Session, TranscriptEntry } from '@/types/models'

const log = createLogger('SessionManager')

let durationTimer: ReturnType<typeof setInterval> | null = null

const debouncedSaveTranscript = debounce((id: string, transcript: string) => {
  useSessionStore.getState().updateSession(id, { transcript })
}, 300)

export function startSession(title?: string, modeId?: string | null): Session {
  const session: Session = {
    id: uuidv4(),
    title: title || `Session - ${new Date().toLocaleString()}`,
    startTime: new Date().toISOString(),
    endTime: null,
    transcript: '',
    summary: null,
    actionItems: [],
    modeId: modeId || null,
    entries: [],
    syncStatus: 'local',
  }

  useSessionStore.getState().addSession(session)
  useSessionStore.getState().setCurrentSession(session)

  // Start duration timer
  durationTimer = setInterval(() => {
    // Timer ticks for UI duration display
  }, 1000)

  log.info(`Session started: ${session.id}`)
  return session
}

export function endSession(): void {
  const store = useSessionStore.getState()
  const session = store.currentSession
  if (!session) return

  if (durationTimer) {
    clearInterval(durationTimer)
    durationTimer = null
  }

  store.updateSession(session.id, {
    endTime: new Date().toISOString(),
  })
  store.setCurrentSession(null)

  log.info(`Session ended: ${session.id}`)
}

export function updateTranscript(transcript: string): void {
  const store = useSessionStore.getState()
  const session = store.currentSession
  if (!session) return

  // Update current session state immediately
  store.updateSession(session.id, { transcript })

  // Debounced persistence
  debouncedSaveTranscript(session.id, transcript)
}

export function addTranscriptEntry(
  speaker: string,
  text: string,
  isFinal: boolean,
): TranscriptEntry {
  const entry: TranscriptEntry = {
    id: uuidv4(),
    sessionId: useSessionStore.getState().currentSession?.id || '',
    timestamp: new Date().toISOString(),
    speaker,
    text,
    isFinal,
  }

  const store = useSessionStore.getState()
  const session = store.currentSession
  if (session) {
    store.updateSession(session.id, {
      entries: [...session.entries, entry],
    })
  }

  return entry
}

export function setSummary(summary: string): void {
  const store = useSessionStore.getState()
  const session = store.currentSession
  if (!session) return
  store.updateSession(session.id, { summary })
}

export function setActionItems(items: string[]): void {
  const store = useSessionStore.getState()
  const session = store.currentSession
  if (!session) return
  store.updateSession(session.id, { actionItems: items })
}

export function deleteSession(id: string): void {
  useSessionStore.getState().removeSession(id)
  log.info(`Session deleted: ${id}`)
}
