import { useAuthStore } from '@/stores/authStore'
import type { AuthRelay } from '@/types/relay'
import * as relay from './relayClient'

/**
 * Keeps `authStore` identical in every window.
 *
 * Any window may perform a login/logout (the dashboard hosts the forms), so
 * every window broadcasts its own transitions; the hidden session host reacts
 * to the relayed state (license, sync, stopping a running session). A guard
 * prevents a relayed update from being re-broadcast in a loop.
 */

let applyingRelay = false
let lastSent = ''
let installed = false

function snapshot(): AuthRelay {
  const s = useAuthStore.getState()
  return {
    authState: s.authState,
    isAuthenticated: s.isAuthenticated,
    currentUser: s.currentUser,
    sessionExpired: s.sessionExpired,
  }
}

export function broadcastAuthState(): void {
  const payload = snapshot()
  if (payload.authState.type === 'unknown') return
  const key = JSON.stringify(payload)
  if (key === lastSent) return
  lastSent = key
  relay.broadcast('relay:auth', payload)
}

export function applyAuthRelay(payload: AuthRelay): void {
  if (!payload || typeof payload !== 'object') return
  const key = JSON.stringify(payload)
  if (key === lastSent) return
  applyingRelay = true
  try {
    lastSent = key
    useAuthStore.setState({
      authState: payload.authState,
      isAuthenticated: payload.isAuthenticated,
      currentUser: payload.currentUser,
      sessionExpired: payload.sessionExpired,
    })
  } finally {
    applyingRelay = false
  }
}

export function installAuthRelay(): () => void {
  if (installed) return () => undefined
  installed = true

  const unsubStore = useAuthStore.subscribe(() => {
    if (applyingRelay) return
    const { authState } = useAuthStore.getState()
    // Transient login-form states stay local to the window showing the form.
    if (
      authState.type === 'unknown' ||
      authState.type === 'authenticating' ||
      authState.type === 'error' ||
      authState.type === 'deviceCodePending'
    ) {
      return
    }
    broadcastAuthState()
  })

  const unsubRelay = relay.on('relay:auth', applyAuthRelay)

  return () => {
    unsubStore()
    unsubRelay()
    installed = false
  }
}
