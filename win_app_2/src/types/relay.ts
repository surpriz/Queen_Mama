import type { AuthState, AuthUser, License } from '@/types/auth'
import type { ResponseType } from '@/types/models'

/**
 * Cross-window relay contract. The hidden session window is the producer of
 * everything except `relay:config` (any window) and `relay:auth` (whichever
 * window performed the login/logout).
 */

export interface AuthRelay {
  authState: AuthState
  isAuthenticated: boolean
  currentUser: AuthUser | null
  sessionExpired: boolean
}

export interface LicenseRelay {
  license: License
  smartModeUsedToday: number
  aiRequestsToday: number
  lastValidatedAt: string | null
  isOffline?: boolean
}

export interface SessionStateRelay {
  isSessionActive: boolean
  sessionStartedAt: number | null
  isFinalizingSession?: boolean
  sessionFinalized?: boolean
  currentSessionId?: string | null
}

export interface TranscriptRelay {
  transcript: string
  interim: string
  audioLevel: number
  isSessionActive: boolean
  sessionStartedAt: number | null
}

export interface AiStateRelay {
  isProcessing: boolean
}

/** Lightweight interim update (the full transcript is only relayed on finals). */
export interface InterimRelay {
  interim: string
}

/** Which audio sources are live (host → UI badges). */
export interface AudioHealthRelay {
  micAvailable: boolean
  systemAudioAvailable: boolean
  systemAudioReceiving: boolean
}

export interface AiResponseHistoryEntry {
  id: string
  type: ResponseType | string
  content: string
  timestamp: string
  provider?: string
  isAutomatic?: boolean
  sessionId?: string | null
}

export type AiResponseRelay =
  | { type: 'streaming'; streamingContent: string }
  | { type: 'history'; entry: AiResponseHistoryEntry }
  | { type: 'clear' }

export interface DictationRelay {
  isRecording: boolean
  interimText: string
  finalText: string
  error?: string | null
}

export interface MomentRelay {
  type: string
  triggerPhrase: string
  confidence?: number
}

export interface ModeRelay {
  modeId: string | null
}

export interface ErrorRelay {
  message: string
}

/** Host → overlay window UI commands (expand / switch tab on proactive answers). */
export interface OverlayRelay {
  expand?: boolean
  selectTab?: ResponseType | string
}

export interface RelayChannels {
  'relay:auth': AuthRelay
  'relay:license': LicenseRelay
  'relay:session-state': SessionStateRelay
  'relay:transcript': TranscriptRelay
  'relay:audio-level': { audioLevel: number }
  'relay:ai-state': AiStateRelay
  'relay:interim': InterimRelay
  'relay:audio-health': AudioHealthRelay
  'relay:ai-response': AiResponseRelay
  'relay:dictation': DictationRelay
  'relay:moment': MomentRelay
  'relay:mode': ModeRelay
  'relay:error': ErrorRelay
  'relay:overlay': OverlayRelay
  'relay:config': Record<string, unknown>
}

export type RelayChannel = keyof RelayChannels

/** Commands a UI window can send to the session host. */
export type SessionCommand =
  | { cmd: 'session.start'; payload: { modeId?: string | null; contactId?: string | null } }
  | { cmd: 'session.stop'; payload?: undefined }
  | { cmd: 'session.toggle'; payload: { modeId?: string | null } }
  | { cmd: 'session.clearContext'; payload?: undefined }
  | { cmd: 'session.setMode'; payload: { modeId: string | null } }
  | { cmd: 'ai.trigger'; payload: { type: ResponseType | string; question?: string } }
  | { cmd: 'ai.clearHistory'; payload?: undefined }
  | { cmd: 'dictation.start'; payload?: undefined }
  | { cmd: 'dictation.stop'; payload?: undefined }
  | { cmd: 'dictation.cancel'; payload?: undefined }
  | { cmd: 'license.revalidate'; payload?: { force?: boolean } }
  | { cmd: 'host.ping'; payload?: undefined }
