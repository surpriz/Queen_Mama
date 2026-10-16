import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useAuthStore } from '@/stores/authStore'
import type { AuthUser } from '@/types/auth'

const broadcast = vi.fn()
let relayListener: ((data: unknown) => void) | null = null

vi.mock('./relayClient', () => ({
  broadcast: (...args: unknown[]) => broadcast(...args),
  on: (_channel: string, cb: (data: unknown) => void) => {
    relayListener = cb
    return () => {
      relayListener = null
    }
  },
  getSnapshot: vi.fn().mockResolvedValue({}),
}))

import { installAuthRelay } from './authRelay'

const user: AuthUser = { id: 'u1', email: 'a@b.c', name: 'A' } as AuthUser

describe('authRelay', () => {
  let dispose: () => void

  beforeEach(() => {
    broadcast.mockClear()
    useAuthStore.setState({
      authState: { type: 'unknown' },
      isAuthenticated: false,
      currentUser: null,
      sessionExpired: false,
    })
    dispose = installAuthRelay()
  })

  it('broadcasts login and logout transitions once each', () => {
    useAuthStore.getState().setAuthenticated(user)
    useAuthStore.getState().logout()

    expect(broadcast).toHaveBeenCalledTimes(2)
    expect(broadcast.mock.calls[0][0]).toBe('relay:auth')
    expect(broadcast.mock.calls[0][1]).toMatchObject({ isAuthenticated: true, currentUser: user })
    expect(broadcast.mock.calls[1][1]).toMatchObject({ isAuthenticated: false })
    dispose()
  })

  it('does not broadcast transient login-form states', () => {
    useAuthStore.getState().setAuthenticating()
    useAuthStore.getState().setError('bad password')
    useAuthStore.getState().setDeviceCodePending('ABCD', 'dc', new Date().toISOString())
    expect(broadcast).not.toHaveBeenCalled()
    dispose()
  })

  it('applies a relayed state without echoing it back', () => {
    expect(relayListener).not.toBeNull()
    relayListener?.({
      authState: { type: 'authenticated', user },
      isAuthenticated: true,
      currentUser: user,
      sessionExpired: false,
    })

    expect(useAuthStore.getState().isAuthenticated).toBe(true)
    expect(useAuthStore.getState().currentUser).toEqual(user)
    expect(broadcast).not.toHaveBeenCalled()
    dispose()
  })
})
