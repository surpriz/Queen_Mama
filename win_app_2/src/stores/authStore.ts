import { create } from 'zustand'
import type { AuthState, AuthUser } from '@/types/auth'

interface AuthStoreState {
  authState: AuthState
  isAuthenticated: boolean
  currentUser: AuthUser | null

  // Actions
  setAuthState: (state: AuthState) => void
  setAuthenticated: (user: AuthUser) => void
  setUnauthenticated: () => void
  setAuthenticating: () => void
  setError: (message: string) => void
  setDeviceCodePending: (userCode: string, deviceCode: string, expiresAt: string) => void
  logout: () => void
}

export const useAuthStore = create<AuthStoreState>((set) => ({
  authState: { type: 'unknown' },
  isAuthenticated: false,
  currentUser: null,

  setAuthState: (authState) => set({ authState }),

  setAuthenticated: (user) =>
    set({
      authState: { type: 'authenticated', user },
      isAuthenticated: true,
      currentUser: user,
    }),

  setUnauthenticated: () =>
    set({
      authState: { type: 'unauthenticated' },
      isAuthenticated: false,
      currentUser: null,
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
    }),
}))
