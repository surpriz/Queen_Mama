import { describe, it, expect, beforeEach, vi } from 'vitest'

type Listener = (data: unknown, seq: number) => void

function installRelayMock(snapshot: Record<string, { data: unknown; seq: number }> = {}) {
  const listeners = new Map<string, Listener[]>()
  const relay = {
    broadcast: vi.fn(),
    toMain: vi.fn(),
    toOverlay: vi.fn(),
    getSnapshot: vi.fn().mockResolvedValue(snapshot),
    on: vi.fn((channel: string, cb: Listener) => {
      const list = listeners.get(channel) ?? []
      list.push(cb)
      listeners.set(channel, list)
      return () => {
        listeners.set(channel, (listeners.get(channel) ?? []).filter((l) => l !== cb))
      }
    }),
  }
  ;(window as unknown as { electronAPI: Record<string, unknown> }).electronAPI = {
    ...(window as unknown as { electronAPI: Record<string, unknown> }).electronAPI,
    relay,
  }
  const emit = (channel: string, data: unknown, seq: number) => {
    for (const cb of listeners.get(channel) ?? []) cb(data, seq)
  }
  return { relay, emit }
}

describe('relayClient', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('delivers events in order and drops stale sequence numbers', async () => {
    const { emit } = installRelayMock()
    const relay = await import('./relayClient')
    const received: unknown[] = []
    relay.on('relay:ai-state', (data) => received.push(data))

    emit('relay:ai-state', { isProcessing: true }, 5)
    emit('relay:ai-state', { isProcessing: false }, 4) // stale → ignored
    emit('relay:ai-state', { isProcessing: false }, 6)

    expect(received).toEqual([{ isProcessing: true }, { isProcessing: false }])
  })

  it('snapshot never overwrites a newer live event', async () => {
    const { emit } = installRelayMock({
      'relay:ai-state': { data: { isProcessing: true }, seq: 3 },
      'relay:license': { data: { license: { plan: 'PRO' } }, seq: 7 },
    })
    const relay = await import('./relayClient')
    relay.on('relay:ai-state', () => undefined)
    emit('relay:ai-state', { isProcessing: false }, 9) // newer than snapshot seq 3

    const snap = await relay.getSnapshot()
    expect(snap['relay:ai-state']).toBeUndefined()
    expect(snap['relay:license']).toEqual({ license: { plan: 'PRO' } })
  })

  it('broadcast forwards to the preload bridge', async () => {
    const { relay: bridge } = installRelayMock()
    const relay = await import('./relayClient')
    relay.broadcast('relay:mode', { modeId: 'm1' })
    expect(bridge.broadcast).toHaveBeenCalledWith('relay:mode', { modeId: 'm1' })
  })
})
