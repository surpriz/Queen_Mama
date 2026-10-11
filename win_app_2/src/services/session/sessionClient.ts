import type { ResponseType } from '@/types/models'
import type { SessionCommand } from '@/types/relay'
import { createLogger } from '@/lib/logger'

const log = createLogger('SessionClient')

/**
 * UI-side facade for commands executed by the hidden session window.
 * Every method resolves when the host has finished (or rejects with the
 * host's error message).
 */

async function invoke<T = unknown>(command: SessionCommand): Promise<T> {
  const api = window.electronAPI?.session
  if (!api?.invoke) throw new Error('Session bridge unavailable')
  const response = await api.invoke(command.cmd, command.payload)
  if (!response.ok) {
    log.warn(`Command ${command.cmd} failed: ${response.error}`)
    throw new Error(response.error)
  }
  return response.result as T
}

export function startSession(modeId?: string | null, contactId?: string | null): Promise<void> {
  return invoke({ cmd: 'session.start', payload: { modeId: modeId ?? null, contactId: contactId ?? null } })
}

export function stopSession(): Promise<void> {
  return invoke({ cmd: 'session.stop' })
}

export function toggleSession(modeId?: string | null): Promise<void> {
  return invoke({ cmd: 'session.toggle', payload: { modeId: modeId ?? null } })
}

export function clearContext(): Promise<void> {
  return invoke({ cmd: 'session.clearContext' })
}

export function setMode(modeId: string | null): Promise<void> {
  return invoke({ cmd: 'session.setMode', payload: { modeId } })
}

export function triggerAI(type: ResponseType | string, question?: string): Promise<string> {
  return invoke<string>({ cmd: 'ai.trigger', payload: { type, question } })
}

export function clearAIHistory(): Promise<void> {
  return invoke({ cmd: 'ai.clearHistory' })
}

export function startDictation(): Promise<void> {
  return invoke({ cmd: 'dictation.start' })
}

export function stopDictation(): Promise<{ text: string }> {
  return invoke<{ text: string }>({ cmd: 'dictation.stop' })
}

export function cancelDictation(): Promise<void> {
  return invoke({ cmd: 'dictation.cancel' })
}

export function revalidateLicense(force = false): Promise<void> {
  return invoke({ cmd: 'license.revalidate', payload: { force } })
}

export function retryTranscription(): Promise<void> {
  return invoke({ cmd: 'transcription.retry' })
}

export function cancelAI(): Promise<void> {
  return invoke({ cmd: 'ai.cancel' })
}
