import { describe, it, expect, beforeEach, vi } from 'vitest'

const dbQuery = vi.fn().mockResolvedValue({ rows: [] })
vi.mock('@/db/client', () => ({
  db: { query: (...args: unknown[]) => dbQuery(...args) },
}))

import { useOverlayStore, setOverlaySessionId } from './overlayStore'
import { ResponseType } from '@/types/models'

describe('overlayStore.addToHistory', () => {
  beforeEach(() => {
    dbQuery.mockClear()
    setOverlaySessionId(null)
    useOverlayStore.setState({ responseHistory: [], streamingContent: '' })
  })

  it('keeps the id/timestamp/provider relayed from the session host', () => {
    useOverlayStore.getState().addToHistory(ResponseType.Assist, 'hello', {
      id: 'resp-1',
      timestamp: '2026-01-01T00:00:00.000Z',
      provider: 'OpenAI',
      isAutomatic: true,
      sessionId: 'sess-1',
    })
    const [entry] = useOverlayStore.getState().responseHistory
    expect(entry).toMatchObject({
      id: 'resp-1',
      timestamp: '2026-01-01T00:00:00.000Z',
      provider: 'OpenAI',
      isAutomatic: true,
      sessionId: 'sess-1',
    })
  })

  it('dedups relayed entries by id (same answer delivered twice)', () => {
    const store = useOverlayStore.getState()
    store.addToHistory(ResponseType.Assist, 'hello', { id: 'resp-1' })
    store.addToHistory(ResponseType.Assist, 'hello', { id: 'resp-1' })
    store.addToHistory(ResponseType.Assist, 'hello', { id: 'resp-2' }) // legit repeat
    expect(useOverlayStore.getState().responseHistory).toHaveLength(2)
  })

  it('does not persist to the DB from a window without a session id (UI mirror)', () => {
    useOverlayStore.getState().addToHistory(ResponseType.Assist, 'hello', { id: 'resp-1', sessionId: 'sess-1' })
    expect(dbQuery).not.toHaveBeenCalled()
  })

  it('persists exactly once in the host (session id set) with the automatic flag', () => {
    setOverlaySessionId('sess-1')
    useOverlayStore.getState().addToHistory(ResponseType.Assist, 'hello', { id: 'resp-1', isAutomatic: true })
    expect(dbQuery).toHaveBeenCalledTimes(1)
    const params = dbQuery.mock.calls[0][1] as unknown[]
    expect(params[0]).toBe('resp-1')
    expect(params[1]).toBe('sess-1')
    expect(params[5]).toBe(1)
  })
})
