import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useSessionStore } from '@/stores/sessionStore'
import { useAuthStore } from '@/stores/authStore'
import { useLicenseStore } from '@/stores/licenseStore'
import { FREE_LICENSE, SubscriptionPlan, SubscriptionStatus } from '@/types/auth'
import type { AuthUser } from '@/types/auth'

const dbQuery = vi.fn().mockResolvedValue({ rows: [] })
vi.mock('@/db/client', () => ({
  db: {
    query: (...args: unknown[]) => dbQuery(...args),
    queryAll: vi.fn().mockResolvedValue([]),
    walCheckpoint: vi.fn().mockResolvedValue({ success: true }),
  },
}))
vi.mock('../auth/authenticationManager', () => ({
  getAccessToken: vi.fn().mockResolvedValue('token'),
  getDeviceId: vi.fn().mockResolvedValue('dev-1'),
}))
vi.mock('@/services/crash/crashReporter', () => ({ captureError: vi.fn() }))

import { reconcileRemoteSessions } from './syncManager'

const PRO = { ...FREE_LICENSE, plan: SubscriptionPlan.Pro, status: SubscriptionStatus.Active, features: { ...FREE_LICENSE.features, sessionSyncEnabled: true } }

function mockPull(sessions: unknown[]) {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ sessions }),
  }) as unknown as typeof fetch
}

describe('syncManager.reconcileRemoteSessions', () => {
  beforeEach(() => {
    dbQuery.mockClear()
    useAuthStore.getState().setAuthenticated({ id: 'u1', email: 'a@b.c' } as AuthUser)
    useLicenseStore.setState({ currentLicense: PRO })
    useSessionStore.setState({ sessions: [], currentSession: null })
  })

  it('persists imported sessions to SQLite with modeId from modeUsed', async () => {
    mockPull([
      {
        id: 'srv-1',
        originalId: '11111111-1111-1111-1111-111111111111',
        title: 'Remote',
        startTime: '2026-01-01T10:00:00.000Z',
        endTime: '2026-01-01T10:30:00.000Z',
        transcript: 'Moi: hello',
        summary: 'sum',
        actionItems: ['do x'],
        modeUsed: 'builtin-sales',
        deviceId: 'dev-2',
      },
    ])

    const result = await reconcileRemoteSessions()

    expect(result.imported).toBe(1)
    const local = useSessionStore.getState().sessions[0]
    expect(local.modeId).toBe('builtin-sales')
    expect(local.syncStatus).toBe('synced')
    expect(local.remoteId).toBe('srv-1')
    const insert = dbQuery.mock.calls.find((c) => String(c[0]).includes('INSERT INTO sessions'))
    expect(insert).toBeDefined()
    expect((insert![1] as unknown[])[7]).toBe('builtin-sales') // mode_id
  })

  it('removes locally a synced session that disappeared from the server', async () => {
    useSessionStore.setState({
      sessions: [
        { id: 'gone', title: 'Gone', startTime: '2026-01-01T09:00:00.000Z', endTime: '2026-01-01T09:30:00.000Z', transcript: 'x', summary: null, actionItems: [], modeId: null, entries: [], syncStatus: 'synced' },
        { id: 'local-only', title: 'Local', startTime: '2026-01-01T09:00:00.000Z', endTime: '2026-01-01T09:30:00.000Z', transcript: 'x', summary: null, actionItems: [], modeId: null, entries: [], syncStatus: 'local' },
      ],
    })
    mockPull([{ id: 'srv-9', originalId: 'other', title: 'Other', startTime: '2026-01-02T09:00:00.000Z', endTime: null, deviceId: 'dev-2' }])

    const result = await reconcileRemoteSessions()

    expect(result.deleted).toBe(1)
    const ids = useSessionStore.getState().sessions.map((s) => s.id)
    expect(ids).not.toContain('gone')
    expect(ids).toContain('local-only') // never uploaded → never a "remote deletion"
  })

  it('does nothing when the user is not entitled to sync', async () => {
    useLicenseStore.setState({ currentLicense: FREE_LICENSE })
    const fetchSpy = vi.fn()
    globalThis.fetch = fetchSpy as unknown as typeof fetch
    const result = await reconcileRemoteSessions()
    expect(result).toEqual({ imported: 0, deleted: 0 })
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
