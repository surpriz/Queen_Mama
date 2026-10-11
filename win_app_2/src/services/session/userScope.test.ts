import { describe, it, expect, beforeEach, vi } from 'vitest'

const dbQuery = vi.fn().mockResolvedValue({ rows: [], changes: 0 })
vi.mock('@/db/client', () => ({
  db: { query: (...args: unknown[]) => dbQuery(...args), queryAll: vi.fn().mockResolvedValue([]) },
}))

import { useAuthStore } from '@/stores/authStore'
import { useSessionStore } from '@/stores/sessionStore'
import { useContactStore } from '@/stores/contactStore'
import { ownerFilter, installUserScopeSync } from './userScope'
import type { AuthUser } from '@/types/auth'
import type { Session, Contact } from '@/types/models'

const userA = { id: 'user-a', email: 'a@x.io' } as AuthUser
const userB = { id: 'user-b', email: 'b@x.io' } as AuthUser

describe('userScope', () => {
  beforeEach(() => {
    dbQuery.mockClear()
    useAuthStore.getState().logout()
    useSessionStore.getState().setSessions([])
    useContactStore.getState().setContacts([])
  })

  it('filters by the signed-in account, and by NULL owner while signed out', () => {
    expect(ownerFilter()).toEqual({ sql: 'owner_user_id IS NULL', params: [] })
    useAuthStore.getState().setAuthenticated(userA)
    expect(ownerFilter('s.owner_user_id')).toEqual({ sql: 's.owner_user_id = ?', params: ['user-a'] })
  })

  it('never rewrites row ownership from the renderer (no adoption on sign-in)', async () => {
    const reload = vi.fn().mockResolvedValue(undefined)
    const dispose = installUserScopeSync(reload)
    useAuthStore.getState().setAuthenticated(userA)
    await new Promise((r) => setTimeout(r, 0))
    expect(dbQuery).not.toHaveBeenCalled()
    expect(reload).toHaveBeenCalledTimes(1)
    dispose()
  })

  it('clears in-memory data on account switch and reloads for the new account', async () => {
    useAuthStore.getState().setAuthenticated(userA)
    useSessionStore.getState().setSessions([{ id: 's1', title: 'A session' } as Session])
    useContactStore.getState().setContacts([{ id: 'c1', name: 'Alice' } as Contact])
    const reload = vi.fn().mockResolvedValue(undefined)
    const dispose = installUserScopeSync(reload)

    useAuthStore.getState().logout()
    expect(useSessionStore.getState().sessions).toEqual([])
    expect(useContactStore.getState().contacts).toEqual([])
    expect(reload).not.toHaveBeenCalled()

    useAuthStore.getState().setAuthenticated(userB)
    await new Promise((r) => setTimeout(r, 0))
    expect(reload).toHaveBeenCalledTimes(1)
    dispose()
  })
})
