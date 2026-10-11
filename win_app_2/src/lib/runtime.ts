/**
 * Which renderer are we running in? All windows load the same bundle and pick
 * their role from the hash route.
 */
export type WindowKind = 'dashboard' | 'overlay' | 'notification' | 'session'

export function getWindowKind(): WindowKind {
  if (typeof window === 'undefined') return 'dashboard'
  const hash = window.location.hash
  if (hash.startsWith('#/session')) return 'session'
  if (hash.startsWith('#/overlay')) return 'overlay'
  if (hash.startsWith('#/notification')) return 'notification'
  return 'dashboard'
}

/** True in the hidden window that owns audio, transcription, AI, auth and license. */
export function isSessionHost(): boolean {
  return getWindowKind() === 'session'
}
