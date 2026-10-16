import type { RelayChannel, RelayChannels } from '@/types/relay'

/**
 * Thin typed wrapper over the preload relay API. Tracks the last applied
 * sequence number per channel so a late snapshot can never overwrite a newer
 * live event.
 */

const lastSeq = new Map<string, number>()

function accept(channel: string, seq: number | undefined): boolean {
  if (typeof seq !== 'number') return true
  const prev = lastSeq.get(channel) ?? 0
  if (seq <= prev) return false
  lastSeq.set(channel, seq)
  return true
}

export function broadcast<C extends RelayChannel>(channel: C, data: RelayChannels[C]): void {
  try {
    window.electronAPI?.relay?.broadcast(channel, data)
  } catch (err) {
    console.warn(`[Relay] broadcast failed on ${channel}:`, err)
  }
}

export function on<C extends RelayChannel>(
  channel: C,
  callback: (data: RelayChannels[C]) => void,
): () => void {
  const api = window.electronAPI?.relay
  if (!api?.on) return () => undefined
  return api.on(channel, (data, seq) => {
    if (!accept(channel, seq)) return
    callback(data as RelayChannels[C])
  })
}

export async function getSnapshot(): Promise<Partial<RelayChannels>> {
  const api = window.electronAPI?.relay
  if (!api?.getSnapshot) return {}
  try {
    const raw = await api.getSnapshot()
    const out: Partial<Record<string, unknown>> = {}
    for (const [channel, entry] of Object.entries(raw)) {
      if (accept(channel, entry.seq)) out[channel] = entry.data
    }
    return out as Partial<RelayChannels>
  } catch (err) {
    console.warn('[Relay] getSnapshot failed:', err)
    return {}
  }
}
