import { create } from 'zustand'
import type { AuthState, AuthUser } from '@/types/auth'

interface AuthStoreState {
  authState: AuthState
  isAuthenticated: boolean
  currentUser: AuthUser | null
  sessionExpired: boolean

  // Actions
  setAuthState: (state: AuthState) => void
  setAuthenticated: (user: AuthUser) => void
  setUnauthenticated: () => void
  setSessionExpired: () => void
  setAuthenticating: () => void
  setError: (message: string) => void
  setDeviceCodePending: (userCode: string, deviceCode: string, expiresAt: string) => void
  logout: () => void
}

export const useAuthStore = create<AuthStoreState>((set) => ({
  authState: { type: 'unknown' },
  isAuthenticated: false,
  currentUser: null,
  sessionExpired: false,

  setAuthState: (authState) => set({ authState }),

  setAuthenticated: (user) =>
    set({
      authState: { type: 'authenticated', user },
      isAuthenticated: true,
      currentUser: user,
      sessionExpired: false,
    }),

  setUnauthenticated: () =>
    set({
      authState: { type: 'unauthenticated' },
      isAuthenticated: false,
      currentUser: null,
    }),

  setSessionExpired: () =>
    set({
      authState: { type: 'unauthenticated' },
      isAuthenticated: false,
      sessionExpired: true,
      // Keep currentUser for "Welcome back" display
    }),

  setAuthenticating: () =>
    set({
      authState: { type: 'authenticating' },
    }),

  setError: (message) =>
    set({
      authState: { type: 'error', message },
    }),

  setDeviceCodePending: (userCode, deviceCode, expiresAt) =>
    set({
      authState: { type: 'deviceCodePending', userCode, deviceCode, expiresAt },
    }),

  logout: () =>
    set({
      authState: { type: 'unauthenticated' },
      isAuthenticated: false,
      currentUser: null,
      sessionExpired: false,
    }),
}))
