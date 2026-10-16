import { useAppStore } from '@/stores/appStore'
import * as relay from '@/services/relay/relayClient'
import * as sessionClient from '@/services/session/sessionClient'
import { isSessionHost } from '@/lib/runtime'
import type { Mode } from '@/types/models'

/**
 * Select the active mode from any UI window: update the local store, tell the
 * other UI windows, and tell the host (whose copy drives prompts / pre-gen).
 */
export function selectMode(mode: Mode | null): void {
  useAppStore.getState().setSelectedMode(mode)
  if (isSessionHost()) return
  relay.broadcast('relay:mode', { modeId: mode?.id ?? null })
  sessionClient.setMode(mode?.id ?? null).catch((err) => {
    console.warn('[ModeSelection] Host mode update failed:', err)
  })
}
